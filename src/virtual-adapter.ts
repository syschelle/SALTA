import { randomUUID } from "node:crypto";
import type { Device, DeviceCommand } from "./types.js";
import type { DeviceRegistry } from "./registry.js";

export type VirtualDeviceKind = "switch" | "button";

const MOMENTARY_BUTTON_RESET_MS = 500;

export class VirtualDeviceAdapter {
  private readonly resetTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly registry: DeviceRegistry) {}

  async create(name: string, kind: VirtualDeviceKind = "switch", roomId?: string, room?: string): Promise<Device> {
    const sourceId = randomUUID();
    const now = new Date().toISOString();
    const button = kind === "button";
    const device: Device = {
      id: `virtual:${sourceId}`,
      source: "virtual",
      sourceId,
      // A virtual button intentionally keeps switch semantics internally and in
      // HomeKit. This makes it writable from Apple Home automations while SALTA
      // presents it as a momentary button and automatically resets it to Off.
      type: "switch",
      presentationType: "switch",
      name: name.trim(),
      model: button ? "SALTA Virtual Button" : "SALTA Virtual Switch",
      profile: button ? "button" : "switch",
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
      adapterData: {
        virtualType: kind,
        ...(button ? { momentaryResetMs: MOMENTARY_BUTTON_RESET_MS } : {})
      }
    };
    this.registry.restore(device.id);
    await this.registry.set(device);
    return device;
  }

  createSwitch(name: string, roomId?: string, room?: string): Promise<Device> {
    return this.create(name, "switch", roomId, room);
  }

  createButton(name: string, roomId?: string, room?: string): Promise<Device> {
    return this.create(name, "button", roomId, room);
  }

  async updateKind(id: string, kind: VirtualDeviceKind): Promise<Device> {
    const current = this.registry.get(id);
    if (!current) throw new Error("DEVICE_NOT_FOUND");
    if (current.source !== "virtual") throw new Error("ADAPTER_NOT_SUPPORTED");
    const timer = this.resetTimers.get(id);
    if (timer) clearTimeout(timer);
    this.resetTimers.delete(id);
    const button = kind === "button";
    const { momentaryResetMs: _momentaryResetMs, ...adapterData } = current.adapterData ?? {};
    const now = new Date().toISOString();
    const updated: Device = {
      ...current,
      type: "switch",
      presentationType: "switch",
      model: button ? "SALTA Virtual Button" : "SALTA Virtual Switch",
      profile: button ? "button" : "switch",
      state: { ...current.state, ...(button ? { on: false } : {}) },
      capabilities: ["toggle", "turnOn", "turnOff"],
      lastSeen: now,
      lastEvent: now,
      adapterData: {
        ...adapterData,
        virtualType: kind,
        ...(button ? { momentaryResetMs: MOMENTARY_BUTTON_RESET_MS } : {})
      }
    };
    await this.registry.set(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const device = this.registry.get(id);
    if (!device) throw new Error("DEVICE_NOT_FOUND");
    if (device.source !== "virtual") throw new Error("ADAPTER_NOT_SUPPORTED");
    const timer = this.resetTimers.get(id);
    if (timer) clearTimeout(timer);
    this.resetTimers.delete(id);
    if (!await this.registry.remove(id)) throw new Error("DEVICE_NOT_FOUND");
  }

  private isMomentaryButton(device: Device): boolean {
    return device.source === "virtual" && device.adapterData?.virtualType === "button";
  }

  private scheduleMomentaryReset(id: string): void {
    const existing = this.resetTimers.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.resetTimers.delete(id);
      void this.resetMomentaryButton(id).catch(() => undefined);
    }, MOMENTARY_BUTTON_RESET_MS);
    timer.unref?.();
    this.resetTimers.set(id, timer);
  }

  private async resetMomentaryButton(id: string): Promise<void> {
    const current = this.registry.get(id);
    if (!current || !this.isMomentaryButton(current) || current.state.on !== true) return;
    const now = new Date().toISOString();
    await this.registry.set({
      ...current,
      reachable: true,
      state: { ...current.state, on: false },
      lastSeen: now,
      lastEvent: now
    });
  }

  async command(command: DeviceCommand): Promise<Device> {
    const device = this.registry.get(command.deviceId);
    if (!device || device.source !== "virtual") throw new Error("DEVICE_NOT_FOUND");
    // Keep the binary command set for legacy persisted virtual records even when
    // older metadata is missing or incomplete.
    const binaryVirtualDevice = ["turnOn", "turnOff", "toggle"].includes(command.capability);
    if (!device.capabilities.includes(command.capability) && !binaryVirtualDevice) throw new Error("CAPABILITY_NOT_SUPPORTED");

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

    if (this.isMomentaryButton(updated) && on) this.scheduleMomentaryReset(updated.id);
    else if (!on) {
      const timer = this.resetTimers.get(updated.id);
      if (timer) clearTimeout(timer);
      this.resetTimers.delete(updated.id);
    }

    return updated;
  }
}
