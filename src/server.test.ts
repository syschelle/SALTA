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
  listRooms: vi.fn(async () => []),
  pool: { query: vi.fn() },
  updateRoom: vi.fn(),
  updateShellySettings: vi.fn()
}));

import { buildServer } from "./server.js";

const openServers: ReturnType<typeof buildServer>[] = [];

afterEach(async () => {
  await Promise.all(openServers.splice(0).map(server => server.close()));
});

function createServer(remove: ShellyAdapter["remove"]) {
  const registry = {
    all: () => [],
    get: () => undefined
  } as unknown as DeviceRegistry;
  const adapter = { remove } as unknown as ShellyAdapter;
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
