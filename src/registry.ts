import { EventEmitter } from "node:events";
import type { CredentialMode, Device, DeviceEvent } from "./types.js";
import { deleteDevice, setDeviceCredentials, updateDeviceHomeKitSettings, upsertDevice } from "./db.js";

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

  emitDeviceEvent(event: DeviceEvent): void {
    for (const listener of this.listeners("deviceEvent")) {
      try {
        listener.call(this, event);
      } catch (error) {
        super.emit("listenerError", { event: "deviceEvent", deviceId: event.deviceId, error });
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
    const current = this.devices.get(input.id);
    const homekitUseSaltaRoom = current?.homekitUseSaltaRoom ?? input.homekitUseSaltaRoom;
    const followsSaltaRoom = homekitUseSaltaRoom !== false;
    const hasHomeKitMetadata = current?.homekitName !== undefined || input.homekitName !== undefined || homekitUseSaltaRoom !== undefined || current?.homekitRoomId !== undefined || input.homekitRoomId !== undefined;
    const device = this.withoutDeletedRoom({
      ...input,
      favorite: input.favorite ?? current?.favorite ?? false,
      homekitEnabled: current?.homekitEnabled ?? input.homekitEnabled,
      ...(current?.homekitName !== undefined || input.homekitName !== undefined ? { homekitName: current?.homekitName ?? input.homekitName } : {}),
      ...(hasHomeKitMetadata ? {
        homekitUseSaltaRoom: homekitUseSaltaRoom ?? true,
        homekitRoomId: followsSaltaRoom ? input.roomId : (current?.homekitRoomId ?? input.homekitRoomId),
        homekitRoom: followsSaltaRoom ? input.room : (current?.homekitRoom ?? input.homekitRoom)
      } : {})
    });
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
      const saltaRoomChanged = current.roomId === roomId && current.room !== roomName;
      const homekitOverrideChanged = current.homekitUseSaltaRoom === false && current.homekitRoomId === roomId && current.homekitRoom !== roomName;
      if (!saltaRoomChanged && !homekitOverrideChanged) continue;
      const next = {
        ...current,
        ...(saltaRoomChanged ? { room: roomName } : {}),
        ...(current.homekitUseSaltaRoom !== false && current.roomId === roomId ? { homekitRoom: roomName, homekitRoomId: roomId } : {}),
        ...(homekitOverrideChanged ? { homekitRoom: roomName } : {})
      };
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
      const saltaRoomDeleted = current.roomId === roomId;
      const homekitOverrideDeleted = current.homekitUseSaltaRoom === false && current.homekitRoomId === roomId;
      if (!saltaRoomDeleted && !homekitOverrideDeleted) continue;
      const next = {
        ...current,
        ...(saltaRoomDeleted ? { roomId: undefined, room: undefined } : {}),
        ...(saltaRoomDeleted && current.homekitUseSaltaRoom !== false ? { homekitRoomId: undefined, homekitRoom: undefined } : {}),
        ...(homekitOverrideDeleted ? { homekitRoomId: undefined, homekitRoom: undefined } : {})
      };
      this.devices.set(id, next);
      this.notify("device", next);
      updated.push(next);
    }
    return updated;
  }

  async patch(id: string, patch: Partial<Pick<Device,"name"|"roomId"|"room"|"homekitEnabled"|"hidden"|"favorite"|"presentationType">>): Promise<Device> {
    const current=this.devices.get(id); if(!current) throw new Error("DEVICE_NOT_FOUND");
    const next={...current,...patch}; await this.set(next); return next;
  }

  async patchHomeKit(id: string, settings: { enabled: boolean; name?: string; useSaltaRoom: boolean; roomId?: string; room?: string }): Promise<Device> {
    const current=this.devices.get(id); if(!current) throw new Error("DEVICE_NOT_FOUND");
    await updateDeviceHomeKitSettings(id,{enabled:settings.enabled,name:settings.name,useSaltaRoom:settings.useSaltaRoom,roomId:settings.roomId});
    const next={
      ...current,
      homekitEnabled:settings.enabled,
      homekitName:settings.name?.trim()||undefined,
      homekitUseSaltaRoom:settings.useSaltaRoom,
      homekitRoomId:settings.useSaltaRoom?current.roomId:settings.roomId,
      homekitRoom:settings.useSaltaRoom?current.room:settings.room
    };
    this.devices.set(id,next);
    this.notify("device",next);
    return next;
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
