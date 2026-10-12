import { getOpenCcuConnection, writeSystemLog } from "./db.js";
import {
  openCcuDeviceFromChannel,
  openCcuTargetTemperaturePlan,
  openCcuThermostatModePlan,
  record,
  type JsonRecord,
  type OpenCcuWriteOperation
} from "./openccu-core.js";
import type { Device, DeviceCommand } from "./types.js";
import type { DeviceRegistry } from "./registry.js";
import type { OpenCcuControlConnection, OpenCcuControlTransport } from "./openccu-control-client.js";

const readbackDelaysMs = [0, 1_000, 3_000, 6_000] as const;

function now(): string {
  return new Date().toISOString();
}

function sleep(delayMs: number): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, delayMs);
    (timer as { unref?: () => void }).unref?.();
  });
}

function finiteNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizedMode(value: unknown): string | undefined {
  const mode = String(value ?? "").trim().toLowerCase();
  return mode || undefined;
}

function writeDiagnostics(interfaceName: string, channelAddress: string, writes: readonly OpenCcuWriteOperation[]) {
  return writes.map(write => ({
    method: "Interface.setValue" as const,
    interface: interfaceName,
    address: channelAddress,
    valueKey: write.parameter,
    type: write.valueType,
    value: write.value
  }));
}

export class OpenCcuThermostatController {
  private readonly commandQueues = new Map<string, Promise<void>>();

  constructor(
    private readonly registry: Pick<DeviceRegistry, "get" | "set">,
    private readonly client: OpenCcuControlTransport
  ) {}

  private async queueCommand<T>(interfaceName: string, action: () => Promise<T>): Promise<T> {
    const previous = this.commandQueues.get(interfaceName) ?? Promise.resolve();
    let resolveResult!: (value: T | PromiseLike<T>) => void;
    let rejectResult!: (reason?: unknown) => void;
    const result = new Promise<T>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    const queued = previous.catch(() => undefined).then(async () => {
      await sleep(250);
      try {
        resolveResult(await action());
      } catch (error) {
        rejectResult(error);
      }
    });
    this.commandQueues.set(interfaceName, queued);
    void queued.finally(() => {
      if (this.commandQueues.get(interfaceName) === queued) this.commandQueues.delete(interfaceName);
    });
    return result;
  }

  private async readLiveDevice(
    connection: OpenCcuControlConnection,
    device: Device,
    interfaceName: string,
    channelAddress: string
  ): Promise<Device> {
    const values = record(await this.client.call(connection, "Interface.getParamset", {
      interface: interfaceName,
      address: channelAddress,
      paramsetKey: "VALUES"
    }));
    const metadata = record(device.adapterData);
    const channelType = String(metadata.channelType ?? "").trim();
    if (!channelType) throw new Error("OPENCCU_DEVICE_METADATA_MISSING");
    const deviceAddress = channelAddress.split(":")[0]?.trim() || channelAddress;
    const discovered = openCcuDeviceFromChannel({
      baseUrl: connection.baseUrl,
      interfaceName,
      channelAddress,
      channelType,
      deviceAddress,
      deviceName: String(metadata.deviceName ?? device.name),
      channelName: String(metadata.channelName ?? device.name),
      model: device.model,
      firmwareVersion: device.firmwareVersion,
      channelCount: device.channelCount,
      values
    });
    if (!discovered || discovered.type !== "thermostat") throw new Error("OPENCCU_DEVICE_READBACK_UNSUPPORTED");
    return discovered;
  }

  private plannerMetadata(device: Device, liveDevice: Device): JsonRecord {
    return {
      ...(liveDevice.adapterData ?? {}),
      ...(device.adapterData ?? {}),
      model: device.model
    };
  }

  private expectedStateMatches(actual: Device, expected: Device["state"]): boolean {
    const expectedTarget = finiteNumber(expected.targetTemperature);
    if (expectedTarget !== undefined) {
      const actualTarget = finiteNumber(actual.state.targetTemperature);
      if (actualTarget === undefined || Math.abs(actualTarget - expectedTarget) > 0.01) return false;
    }
    const expectedMode = normalizedMode(expected.controlMode);
    if (expectedMode && normalizedMode(actual.state.controlMode) !== expectedMode) return false;
    return true;
  }

  private async execute(
    command: DeviceCommand,
    device: Device,
    connection: OpenCcuControlConnection,
    interfaceName: string,
    channelAddress: string
  ): Promise<Device> {
    const diagnosticContext = command.diagnosticContext ? { ...command.diagnosticContext } : {};
    let liveBefore: Device | undefined;
    let readback: Device | undefined;
    let readbackAttempts = 0;
    let writes: OpenCcuWriteOperation[] = [];
    let appliedWrites = 0;
    let expectedState: Device["state"] = {};

    try {
      liveBefore = await this.readLiveDevice(connection, device, interfaceName, channelAddress);
      const metadata = this.plannerMetadata(device, liveBefore);
      const plan = command.capability === "setTargetTemperature"
        ? openCcuTargetTemperaturePlan(metadata, liveBefore.state, command.value)
        : openCcuThermostatModePlan(metadata, liveBefore.state, command.value);
      writes = [...plan.writes];
      expectedState = { ...plan.state };
      if (!writes.length) throw new Error("CAPABILITY_NOT_SUPPORTED");

      for (const write of writes) {
        await this.client.call(connection, "Interface.setValue", {
          interface: interfaceName,
          address: channelAddress,
          valueKey: write.parameter,
          type: write.valueType,
          value: write.value
        });
        appliedWrites += 1;
      }

      let lastReadbackError: unknown;
      for (const delayMs of readbackDelaysMs) {
        if (delayMs > 0) await sleep(delayMs);
        readbackAttempts += 1;
        try {
          const candidate = await this.readLiveDevice(connection, device, interfaceName, channelAddress);
          readback = candidate;
          if (this.expectedStateMatches(candidate, expectedState)) break;
        } catch (error) {
          lastReadbackError = error;
        }
      }

      if (!readback || !this.expectedStateMatches(readback, expectedState)) {
        const expectedTarget = expectedState.targetTemperature;
        const expectedMode = expectedState.controlMode;
        const actualTarget = readback?.state.targetTemperature;
        const actualMode = readback?.state.controlMode;
        const reason = lastReadbackError instanceof Error && !readback
          ? lastReadbackError.message
          : `expected ${String(expectedTarget ?? "unchanged")} / ${String(expectedMode ?? "unchanged")}, got ${String(actualTarget ?? "unknown")} / ${String(actualMode ?? "unknown")}`;
        throw new Error(`OPENCCU_COMMAND_READBACK_MISMATCH:${reason}`);
      }

      const updated: Device = {
        ...device,
        state: { ...device.state, ...readback.state },
        reachable: true,
        lastSeen: now(),
        lastEvent: now()
      };
      await this.registry.set(updated);
      await writeSystemLog("info", "openccu", "OPENCCU_COMMAND_APPLIED", "OpenCCU thermostat command applied and verified", {
        ...diagnosticContext,
        commandSource: command.source,
        deviceId: device.id,
        deviceName: device.name,
        model: device.model,
        interfaceName,
        channelAddress,
        capability: command.capability,
        requestedValue: command.value,
        liveStateBeforeCommand: { ...liveBefore.state },
        liveStateOrigin: "openccu-live-getParamset-before-command",
        writes: writeDiagnostics(interfaceName, channelAddress, writes),
        appliedWrites,
        expectedState,
        readbackStateAfterCommand: { ...readback.state },
        readbackStateOrigin: "openccu-live-getParamset-after-command",
        readbackAttempts,
        verified: true
      }).catch(() => undefined);
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await writeSystemLog("error", "openccu", "OPENCCU_COMMAND_FAILED", "OpenCCU thermostat command failed", {
        ...diagnosticContext,
        commandSource: command.source,
        deviceId: device.id,
        deviceName: device.name,
        model: device.model,
        interfaceName,
        channelAddress,
        capability: command.capability,
        requestedValue: command.value,
        liveStateBeforeCommand: liveBefore ? { ...liveBefore.state } : undefined,
        liveStateOrigin: "openccu-live-getParamset-before-command",
        writes: writeDiagnostics(interfaceName, channelAddress, writes),
        appliedWrites,
        expectedState,
        readbackStateAfterCommand: readback ? { ...readback.state } : undefined,
        readbackStateOrigin: "openccu-live-getParamset-after-command",
        readbackAttempts,
        errorCode: message.split(":", 1)[0],
        remoteMessage: message
      }).catch(() => undefined);
      throw error;
    }
  }

  async command(command: DeviceCommand): Promise<Device> {
    const device = this.registry.get(command.deviceId);
    if (!device || device.source !== "openccu" || device.type !== "thermostat") throw new Error("DEVICE_NOT_FOUND");
    if (!["setTargetTemperature", "setThermostatMode"].includes(command.capability)) throw new Error("CAPABILITY_NOT_SUPPORTED");
    const metadata = record(device.adapterData);
    const interfaceName = String(metadata.interfaceName ?? "").trim();
    const channelAddress = String(metadata.channelAddress ?? "").trim();
    if (!interfaceName || !channelAddress) throw new Error("OPENCCU_DEVICE_METADATA_MISSING");
    const connection = await getOpenCcuConnection();
    if (!connection.baseUrl || !connection.username || !connection.password) throw new Error("OPENCCU_NOT_CONFIGURED");
    return this.queueCommand(interfaceName, () => this.execute(command, device, connection, interfaceName, channelAddress));
  }
}
