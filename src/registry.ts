import { EventEmitter } from "node:events";
import type { CredentialMode, Device } from "./types.js";
import { setDeviceCredentials, upsertDevice } from "./db.js";

export class DeviceRegistry extends EventEmitter {
  private readonly devices = new Map<string, Device>();

  async set(device: Device): Promise<void> {
    this.devices.set(device.id, device);
    await upsertDevice(device);
    this.emit("device", device);
  }
  get(id: string): Device | undefined { return this.devices.get(id); }
  all(): Device[] { return [...this.devices.values()].sort((a,b)=>a.name.localeCompare(b.name)); }
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
