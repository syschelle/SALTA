import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "./types.js";

const dbMocks = vi.hoisted(() => ({
  deleteDevice: vi.fn(async (): Promise<boolean> => true),
  setDeviceCredentials: vi.fn(async (): Promise<void> => undefined),
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
});
