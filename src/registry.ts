import { EventEmitter } from "node:events";
import type { CredentialMode, Device } from "./types.js";
import { deleteDevice, setDeviceCredentials, upsertDevice } from "./db.js";

export class DeviceRegistry extends EventEmitter {
  private readonly devices = new Map<string, Device>();
  private readonly removedDeviceIds = new Set<string>();
  private readonly deletedRoomIds = new Set<string>();

  private notify(event: "device" | "deviceRemoved", device: Device): void {
    for (const listener of this.listeners(event)) {
      try {
        listener.call(this, device);
      } catch (error) {
        super.emit("listenerError", { event, deviceId: device.id, error });
      }
    }
  }

  private withoutDeletedRoom(device: Device): Device {
    if (!device.roomId || !this.deletedRoomIds.has(device.roomId)) return device;
    return { ...device, roomId: undefined, room: undefined };
  }

  hydrate(device: Device): void {
    if (this.removedDeviceIds.has(device.id)) return;
    this.devices.set(device.id, this.withoutDeletedRoom(device));
  }

  async set(input: Device): Promise<void> {
    if (this.removedDeviceIds.has(input.id)) return;
    const device = this.withoutDeletedRoom(input);
    this.devices.set(device.id, device);
    await upsertDevice(device);
    if (this.removedDeviceIds.has(device.id)) {
      await deleteDevice(device.id);
      this.devices.delete(device.id);
      return;
    }
    this.notify("device", device);
  }

  restore(id: string): void {
    this.removedDeviceIds.delete(id);
  }

  get(id: string): Device | undefined { return this.devices.get(id); }
  all(): Device[] { return [...this.devices.values()].sort((a,b)=>a.name.localeCompare(b.name)); }

  async remove(id: string): Promise<boolean> {
    const current = this.devices.get(id);
    if (!current) return false;
    this.removedDeviceIds.add(id);
    try {
      await deleteDevice(id);
      this.devices.delete(id);
      this.notify("deviceRemoved", current);
      return true;
    } catch (error) {
      this.removedDeviceIds.delete(id);
      throw error;
    }
  }

  async removeSource(source: string): Promise<number> {
    const ids = this.all().filter(device => device.source === source).map(device => device.id);
    let removed = 0;
    for (const id of ids) {
      if (await this.remove(id)) removed += 1;
    }
    return removed;
  }

  updateRoomName(roomId: string, roomName: string): Device[] {
    const updated: Device[] = [];
    for (const [id, current] of this.devices) {
      if (current.roomId !== roomId || current.room === roomName) continue;
      const next = { ...current, room: roomName };
      this.devices.set(id, next);
      this.notify("device", next);
      updated.push(next);
    }
    return updated;
  }

  clearRoom(roomId: string): Device[] {
    this.deletedRoomIds.add(roomId);
    const updated: Device[] = [];
    for (const [id, current] of this.devices) {
      if (current.roomId !== roomId) continue;
      const next = { ...current, roomId: undefined, room: undefined };
      this.devices.set(id, next);
      this.notify("device", next);
      updated.push(next);
    }
    return updated;
  }

  async patch(id: string, patch: Partial<Pick<Device,"name"|"roomId"|"room"|"homekitEnabled"|"presentationType">>): Promise<Device> {
    const current=this.devices.get(id); if(!current) throw new Error("DEVICE_NOT_FOUND");
    const next={...current,...patch}; await this.set(next); return next;
  }

  async patchCredentials(id: string, credentialMode: CredentialMode, credentialUsername?: string, password?: string): Promise<Device> {
    const current=this.devices.get(id); if(!current) throw new Error("DEVICE_NOT_FOUND");
    await setDeviceCredentials(id, credentialMode, credentialUsername, password);
    const next={...current,credentialMode,credentialUsername,passwordConfigured: password === undefined ? current.passwordConfigured : Boolean(password)};
    this.devices.set(id,next);
    this.notify("device",next);
    return next;
  }
}
