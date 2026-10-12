import type { Device, DeviceCommand } from "./types.js";
import type { DeviceRegistry } from "./registry.js";

type CommandAdapter = { command(command: DeviceCommand): Promise<Device> };

export interface DeviceCommandRoute {
  source: string;
  type?: Device["type"];
  capabilities?: readonly string[];
  adapter: CommandAdapter;
}

export class DeviceCommandRouter {
  constructor(
    private readonly registry: DeviceRegistry,
    private readonly adapters: Readonly<Record<string, CommandAdapter>>,
    private readonly routes: readonly DeviceCommandRoute[] = []
  ) {}

  async command(command: DeviceCommand): Promise<Device> {
    const device = this.registry.get(command.deviceId);
    if (!device) throw new Error("DEVICE_NOT_FOUND");
    const route = this.routes.find(candidate => candidate.source === device.source
      && (candidate.type === undefined || candidate.type === device.type)
      && (candidate.capabilities === undefined || candidate.capabilities.includes(command.capability)));
    const adapter = route?.adapter ?? this.adapters[device.source];
    if (!adapter) throw new Error("ADAPTER_NOT_SUPPORTED");
    return adapter.command(command);
  }
}
