import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeviceRegistry } from "./registry.js";
import type { ShellyAdapter } from "./shelly-adapter.js";

vi.mock("./config.js", () => ({
  config: {
    ADMIN_PASSWORD: "",
    ADMIN_USERNAME: "admin",
    LOG_LEVEL: "silent"
  }
}));

vi.mock("./db.js", () => ({
  createRoom: vi.fn(),
  deleteRoom: vi.fn(),
  getGlobalShellyCredentials: vi.fn(),
  getShellySettings: vi.fn(),
  inspectCredentialEncryption: vi.fn(async () => ({ status: "ok", globalCredential: "not-configured", invalidDeviceIds: [] })),
  listRooms: vi.fn(async () => []),
  pool: { query: vi.fn() },
  reorderRooms: vi.fn(),
  updateRoom: vi.fn(),
  updateShellySettings: vi.fn()
}));

import { getGlobalShellyCredentials, reorderRooms, updateRoom } from "./db.js";
import { buildServer } from "./server.js";

const openServers: ReturnType<typeof buildServer>[] = [];

afterEach(async () => {
  await Promise.all(openServers.splice(0).map(server => server.close()));
});

function createServer(remove: ShellyAdapter["remove"], add: ShellyAdapter["add"] = vi.fn(), registryOverrides: Partial<DeviceRegistry> = {}) {
  const registry = {
    all: () => [],
    get: () => undefined,
    ...registryOverrides
  } as unknown as DeviceRegistry;
  const adapter = { remove, add } as unknown as ShellyAdapter;
  const server = buildServer(registry, adapter);
  openServers.push(server);
  return server;
}


describe("PUT /api/rooms/:id", () => {
  it("synchronizes a renamed room into the in-memory device registry", async () => {
    const room = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Living area",
      icon: "sofa-outline",
      sortOrder: 0,
      createdAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z"
    };
    vi.mocked(updateRoom).mockResolvedValueOnce(room);
    const updateRoomName = vi.fn();
    const server = createServer(vi.fn(), vi.fn(), { updateRoomName });

    const response = await server.inject({
      method: "PUT",
      url: `/api/rooms/${room.id}`,
      payload: { name: room.name, icon: room.icon, sortOrder: 0 }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(room);
    expect(updateRoomName).toHaveBeenCalledWith(room.id, room.name);
  });
});


describe("PUT /api/rooms/order", () => {
  it("persists and returns the requested room order", async () => {
    const orderedRooms = [
      { id: "22222222-2222-4222-8222-222222222222", name: "Kitchen", icon: "silverware-fork-knife", sortOrder: 0, createdAt: "2026-07-22T00:00:00.000Z", updatedAt: "2026-07-22T00:00:00.000Z" },
      { id: "11111111-1111-4111-8111-111111111111", name: "Living room", icon: "sofa-outline", sortOrder: 1, createdAt: "2026-07-22T00:00:00.000Z", updatedAt: "2026-07-22T00:00:00.000Z" }
    ];
    vi.mocked(reorderRooms).mockResolvedValueOnce(orderedRooms);
    const server = createServer(vi.fn());

    const response = await server.inject({
      method: "PUT",
      url: "/api/rooms/order",
      payload: { roomIds: orderedRooms.map(room => room.id) }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(orderedRooms);
    expect(reorderRooms).toHaveBeenCalledWith(orderedRooms.map(room => room.id));
  });
});

describe("DELETE /api/devices/:id", () => {
  it("returns 204 after removing a Shelly device", async () => {
    const remove = vi.fn(async (): Promise<void> => undefined);
    const server = createServer(remove);

    const response = await server.inject({
      method: "DELETE",
      url: "/api/devices/shelly%3Atest-device"
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(remove).toHaveBeenCalledWith("shelly:test-device");
  });

  it("returns a structured 404 response for unknown devices", async () => {
    const remove = vi.fn(async (): Promise<void> => {
      throw new Error("DEVICE_NOT_FOUND");
    });
    const server = createServer(remove);

    const response = await server.inject({
      method: "DELETE",
      url: "/api/devices/missing"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: {
        code: "DEVICE_NOT_FOUND",
        message: "Device not found"
      }
    });
  });
});


describe("PATCH /api/devices/:id/config", () => {
  it("updates the display name of an energy meter", async () => {
    const updatedDevice = { id: "shelly:3em", type: "energyMeter", name: "Main distribution" };
    const patch = vi.fn(async () => updatedDevice as never);
    const server = createServer(vi.fn(), vi.fn(), { patch });

    const response = await server.inject({
      method: "PATCH",
      url: "/api/devices/shelly%3A3em/config",
      payload: { name: "  Main distribution  ", roomId: null }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(updatedDevice);
    expect(patch).toHaveBeenCalledWith("shelly:3em", {
      name: "Main distribution",
      roomId: undefined,
      room: undefined
    });
  });
  it("assigns a fan presentation type to an on/off Shelly relay", async () => {
    const current = {
      id: "shelly:relay", type: "switch", capabilities: ["turnOn", "turnOff", "toggle"]
    };
    const updatedDevice = { ...current, presentationType: "fan" };
    const patch = vi.fn(async () => updatedDevice as never);
    const server = createServer(vi.fn(), vi.fn(), { get: () => current as never, patch });

    const response = await server.inject({
      method: "PATCH",
      url: "/api/devices/shelly%3Arelay/config",
      payload: { presentationType: "fan" }
    });

    expect(response.statusCode).toBe(200);
    expect(patch).toHaveBeenCalledWith("shelly:relay", {
      presentationType: "fan",
      roomId: undefined,
      room: undefined
    });
  });

  it("rejects presentation overrides for non-switchable devices", async () => {
    const current = { id: "shelly:3em", type: "energyMeter", capabilities: [] };
    const patch = vi.fn();
    const server = createServer(vi.fn(), vi.fn(), { get: () => current as never, patch });

    const response = await server.inject({
      method: "PATCH",
      url: "/api/devices/shelly%3A3em/config",
      payload: { presentationType: "fan" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "PRESENTATION_TYPE_NOT_SUPPORTED" } });
    expect(patch).not.toHaveBeenCalled();
  });

});


describe("POST /api/adapters/shelly/devices", () => {
  it("adds a Shelly device without authentication", async () => {
    const addedDevice = { id: "shelly:test", name: "Test Shelly" };
    const add = vi.fn(async () => [addedDevice] as never);
    const server = createServer(vi.fn(), add);

    const response = await server.inject({
      method: "POST",
      url: "/api/adapters/shelly/devices",
      payload: { host: "192.168.1.50", credentialMode: "none", roomId: null }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ ...addedDevice, addedDevices: 1 });
    expect(add).toHaveBeenCalledWith("192.168.1.50", "", "", undefined, undefined, undefined, "none");
  });

  it("returns a readable error when the Shelly is unreachable", async () => {
    const add = vi.fn(async () => { throw new Error("DEVICE_UNREACHABLE"); });
    const server = createServer(vi.fn(), add);

    const response = await server.inject({
      method: "POST",
      url: "/api/adapters/shelly/devices",
      payload: { host: "192.168.1.99", credentialMode: "none" }
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({
      error: {
        code: "DEVICE_UNREACHABLE",
        message: "The Shelly device is unreachable at the specified address."
      }
    });
  });

  it("returns a specific error when global credentials cannot be decrypted", async () => {
    vi.mocked(getGlobalShellyCredentials).mockRejectedValueOnce(new Error("ENCRYPTION_KEY_MISMATCH"));
    const add = vi.fn();
    const server = createServer(vi.fn(), add);

    const response = await server.inject({
      method: "POST",
      url: "/api/adapters/shelly/devices",
      payload: { host: "192.168.1.50", credentialMode: "inherit" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "ENCRYPTION_KEY_MISMATCH" } });
    expect(add).not.toHaveBeenCalled();
  });

  it("requires a username for custom credentials", async () => {
    const add = vi.fn();
    const server = createServer(vi.fn(), add);

    const response = await server.inject({
      method: "POST",
      url: "/api/adapters/shelly/devices",
      payload: { host: "192.168.1.50", credentialMode: "custom", password: "secret" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "USERNAME_REQUIRED" } });
    expect(add).not.toHaveBeenCalled();
  });
});
