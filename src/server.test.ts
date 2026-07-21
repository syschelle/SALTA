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
  updateRoom: vi.fn(),
  updateShellySettings: vi.fn()
}));

import { getGlobalShellyCredentials } from "./db.js";
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
});


describe("POST /api/adapters/shelly/devices", () => {
  it("adds a Shelly device without authentication", async () => {
    const addedDevice = { id: "shelly:test", name: "Test Shelly" };
    const add = vi.fn(async () => addedDevice as never);
    const server = createServer(vi.fn(), add);

    const response = await server.inject({
      method: "POST",
      url: "/api/adapters/shelly/devices",
      payload: { host: "192.168.1.50", credentialMode: "none", roomId: null }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(addedDevice);
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
