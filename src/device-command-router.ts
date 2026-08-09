import type { Device, DeviceCommand } from "./types.js";
import type { DeviceRegistry } from "./registry.js";

type CommandAdapter = { command(command: DeviceCommand): Promise<Device> };

export class DeviceCommandRouter {
  constructor(
    private readonly registry: DeviceRegistry,
    private readonly adapters: Readonly<Record<string, CommandAdapter>>
  ) {}

  async command(command: DeviceCommand): Promise<Device> {
    const device = this.registry.get(command.deviceId);
    if (!device) throw new Error("DEVICE_NOT_FOUND");
    const adapter = this.adapters[device.source];
    if (!adapter) throw new Error("ADAPTER_NOT_SUPPORTED");
    return adapter.command(command);
  }
}
