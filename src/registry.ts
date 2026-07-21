import { EventEmitter } from "node:events";
import type { CredentialMode, Device } from "./types.js";
import { deleteDevice, setDeviceCredentials, upsertDevice } from "./db.js";

export class DeviceRegistry extends EventEmitter {
  private readonly devices = new Map<string, Device>();
  private readonly removedDeviceIds = new Set<string>();

  async set(device: Device): Promise<void> {
    if (this.removedDeviceIds.has(device.id)) return;
    this.devices.set(device.id, device);
    await upsertDevice(device);
    if (this.removedDeviceIds.has(device.id)) {
      await deleteDevice(device.id);
      this.devices.delete(device.id);
      return;
    }
    this.emit("device", device);
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
      this.emit("deviceRemoved", current);
      return true;
    } catch (error) {
      this.removedDeviceIds.delete(id);
      throw error;
    }
  }

  async patch(id: string, patch: Partial<Pick<Device,"name"|"roomId"|"room"|"homekitEnabled">>): Promise<Device> {
    const current=this.devices.get(id); if(!current) throw new Error("DEVICE_NOT_FOUND");
    const next={...current,...patch}; await this.set(next); return next;
  }

  async patchCredentials(id: string, credentialMode: CredentialMode, credentialUsername?: string, password?: string): Promise<Device> {
    const current=this.devices.get(id); if(!current) throw new Error("DEVICE_NOT_FOUND");
    await setDeviceCredentials(id, credentialMode, credentialUsername, password);
    const next={...current,credentialMode,credentialUsername,passwordConfigured: password === undefined ? current.passwordConfigured : Boolean(password)};
    this.devices.set(id,next);
    this.emit("device",next);
    return next;
  }
}
