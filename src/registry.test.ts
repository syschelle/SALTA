import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "./types.js";

const dbMocks = vi.hoisted(() => ({
  deleteDevice: vi.fn(async (): Promise<boolean> => true),
  setDeviceCredentials: vi.fn(async (): Promise<void> => undefined),
  updateDeviceHomeKitSettings: vi.fn(async (): Promise<void> => undefined),
  upsertDevice: vi.fn(async (): Promise<void> => undefined)
}));

vi.mock("./db.js", () => dbMocks);

import { DeviceRegistry } from "./registry.js";

const device: Device = {
  id: "shelly:test-device",
  source: "shelly",
  sourceId: "test-device",
  type: "switch",
  name: "Test Shelly",
  host: "192.168.1.50",
  reachable: true,
  state: { on: false },
  capabilities: ["toggle", "turnOn", "turnOff"],
  homekitEnabled: true,
  hidden: false,
  favorite: false,
  credentialMode: "inherit",
  passwordConfigured: false,
  lastSeen: "2026-07-21T12:00:00.000Z",
  lastEvent: "2026-07-21T12:00:00.000Z"
};

describe("DeviceRegistry removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes the device from memory and persistent storage", async () => {
    const registry = new DeviceRegistry();
    await registry.set(device);
    const removedListener = vi.fn();
    registry.on("deviceRemoved", removedListener);

    await expect(registry.remove(device.id)).resolves.toBe(true);

    expect(dbMocks.deleteDevice).toHaveBeenCalledWith(device.id);
    expect(registry.get(device.id)).toBeUndefined();
    expect(removedListener).toHaveBeenCalledWith(device);
  });

  it("does not recreate a device from a stale refresh after removal", async () => {
    let finishUpsert: (() => void) | undefined;
    dbMocks.upsertDevice.mockImplementationOnce(() => new Promise<void>(resolve => {
      finishUpsert = resolve;
    }));

    const registry = new DeviceRegistry();
    const pendingSet = registry.set(device);
    await Promise.resolve();

    await expect(registry.remove(device.id)).resolves.toBe(true);
    finishUpsert?.();
    await pendingSet;

    expect(registry.get(device.id)).toBeUndefined();
    expect(dbMocks.deleteDevice).toHaveBeenCalledTimes(2);
  });


  it("does not fail persistence when an integration listener throws", async () => {
    const registry = new DeviceRegistry();
    const listenerError = vi.fn();
    registry.on("device", () => { throw new Error("HOMEKIT_SYNC_FAILED"); });
    registry.on("listenerError", listenerError);

    await expect(registry.set(device)).resolves.toBeUndefined();

    expect(registry.get(device.id)).toEqual(device);
    expect(listenerError).toHaveBeenCalledWith(expect.objectContaining({
      event: "device",
      deviceId: device.id
    }));
  });


  it("updates the room name of every assigned device in memory", async () => {
    const registry = new DeviceRegistry();
    const roomDevice = { ...device, roomId: "11111111-1111-4111-8111-111111111111", room: "Old room" };
    const deviceListener = vi.fn();
    await registry.set(roomDevice);
    registry.on("device", deviceListener);

    const updated = registry.updateRoomName(roomDevice.roomId, "New room");

    expect(updated).toHaveLength(1);
    expect(registry.get(device.id)?.room).toBe("New room");
    expect(deviceListener).toHaveBeenCalledWith(expect.objectContaining({ room: "New room" }));
  });

  it("allows a deliberately re-added device after restore", async () => {
    const registry = new DeviceRegistry();
    await registry.set(device);
    await registry.remove(device.id);

    registry.restore(device.id);
    await registry.set(device);

    expect(registry.get(device.id)).toEqual(device);
  });

  it("persists Zigbee visibility changes", async () => {
    const registry = new DeviceRegistry();
    const zigbee = { ...device, id: "phoscon:test", source: "phoscon", hidden: false };
    await registry.set(zigbee);

    const updated = await registry.patch(zigbee.id, { hidden: true });

    expect(updated.hidden).toBe(true);
    expect(registry.get(zigbee.id)?.hidden).toBe(true);
    expect(dbMocks.upsertDevice).toHaveBeenLastCalledWith(expect.objectContaining({ hidden: true }));
  });

  it("hydrates persisted devices without writing them back to PostgreSQL", () => {
    const registry = new DeviceRegistry();
    const deviceListener = vi.fn();
    registry.on("device", deviceListener);

    registry.hydrate(device);

    expect(registry.get(device.id)).toEqual(device);
    expect(dbMocks.upsertDevice).not.toHaveBeenCalled();
    expect(deviceListener).not.toHaveBeenCalled();
  });

  it("clears a deleted room from every assigned device in memory", async () => {
    const registry = new DeviceRegistry();
    const roomId = "11111111-1111-4111-8111-111111111111";
    await registry.set({ ...device, roomId, room: "Old room" });
    const deviceListener = vi.fn();
    registry.on("device", deviceListener);

    const updated = registry.clearRoom(roomId);

    expect(updated).toHaveLength(1);
    expect(registry.get(device.id)).toMatchObject({ roomId: undefined, room: undefined });
    expect(deviceListener).toHaveBeenCalledWith(expect.objectContaining({ roomId: undefined, room: undefined }));
    expect(dbMocks.upsertDevice).toHaveBeenCalledTimes(1);

    await registry.set({ ...device, roomId, room: "Stale room from an in-flight refresh" });

    expect(registry.get(device.id)).toMatchObject({ roomId: undefined, room: undefined });
    expect(dbMocks.upsertDevice).toHaveBeenLastCalledWith(expect.objectContaining({ roomId: undefined, room: undefined }));
  });

  it("persists HomeKit publication, name and SALTA-room inheritance independently from adapter refreshes", async () => {
    const registry = new DeviceRegistry();
    const roomId = "11111111-1111-4111-8111-111111111111";
    await registry.set({ ...device, roomId, room: "Wohnzimmer" });
    const updated = await registry.patchHomeKit(device.id, { enabled: true, name: "Fernseher", useSaltaRoom: true });
    expect(dbMocks.updateDeviceHomeKitSettings).toHaveBeenCalledWith(device.id, { enabled: true, name: "Fernseher", useSaltaRoom: true, roomId: undefined });
    expect(updated).toMatchObject({ homekitEnabled: true, homekitName: "Fernseher", homekitUseSaltaRoom: true, homekitRoomId: roomId, homekitRoom: "Wohnzimmer" });
    await registry.set({ ...device, roomId, room: "Wohnzimmer", state: { on: true } });
    expect(registry.get(device.id)).toMatchObject({ homekitName: "Fernseher", homekitUseSaltaRoom: true, homekitRoom: "Wohnzimmer", state: { on: true } });
  });

  it("keeps an explicit HomeKit target room separate from the device room", async () => {
    const registry = new DeviceRegistry();
    const deviceRoomId = "11111111-1111-4111-8111-111111111111";
    const targetRoomId = "22222222-2222-4222-8222-222222222222";
    await registry.set({ ...device, roomId: deviceRoomId, room: "Wohnzimmer" });
    await registry.patchHomeKit(device.id, { enabled: true, useSaltaRoom: false, roomId: targetRoomId, room: "Büro" });
    expect(registry.get(device.id)).toMatchObject({ homekitUseSaltaRoom: false, homekitRoomId: targetRoomId, homekitRoom: "Büro" });
  });

});
