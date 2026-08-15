import { randomUUID } from "node:crypto";
import type { Device, DeviceCommand } from "./types.js";
import type { DeviceRegistry } from "./registry.js";

export class VirtualDeviceAdapter {
  constructor(private readonly registry: DeviceRegistry) {}

  async createSwitch(name: string, roomId?: string, room?: string): Promise<Device> {
    const sourceId = randomUUID();
    const now = new Date().toISOString();
    const device: Device = {
      id: `virtual:${sourceId}`,
      source: "virtual",
      sourceId,
      type: "switch",
      presentationType: "switch",
      name: name.trim(),
      model: "SALTA Virtual Switch",
      profile: "switch",
      roomId,
      room,
      reachable: true,
      state: { on: false },
      capabilities: ["toggle", "turnOn", "turnOff"],
      homekitEnabled: true,
      hidden: false,
      credentialMode: "none",
      passwordConfigured: false,
      lastSeen: now,
      lastEvent: now,
      adapterData: { virtualType: "switch" }
    };
    this.registry.restore(device.id);
    await this.registry.set(device);
    return device;
  }

  async remove(id: string): Promise<void> {
    const device = this.registry.get(id);
    if (!device) throw new Error("DEVICE_NOT_FOUND");
    if (device.source !== "virtual") throw new Error("ADAPTER_NOT_SUPPORTED");
    if (!await this.registry.remove(id)) throw new Error("DEVICE_NOT_FOUND");
  }

  async command(command: DeviceCommand): Promise<Device> {
    const device = this.registry.get(command.deviceId);
    if (!device || device.source !== "virtual") throw new Error("DEVICE_NOT_FOUND");
    const binaryVirtualSwitch = device.type === "switch" && typeof device.state.on === "boolean" && ["turnOn", "turnOff", "toggle"].includes(command.capability);
    if (!device.capabilities.includes(command.capability) && !binaryVirtualSwitch) throw new Error("CAPABILITY_NOT_SUPPORTED");

    let on: boolean;
    if (command.capability === "toggle") on = !Boolean(device.state.on);
    else if (command.capability === "turnOn") on = true;
    else if (command.capability === "turnOff") on = false;
    else throw new Error("CAPABILITY_NOT_SUPPORTED");

    const now = new Date().toISOString();
    const updated: Device = {
      ...device,
      reachable: true,
      state: { ...device.state, on },
      lastSeen: now,
      lastEvent: now
    };
    await this.registry.set(updated);
    return updated;
  }
}
