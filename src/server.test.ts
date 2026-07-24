import type { InjectOptions } from "light-my-request";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeviceRegistry } from "./registry.js";
import type { ShellyAdapter } from "./shelly-adapter.js";
import type { PhosconAdapter } from "./phoscon-adapter.js";
import type { OpenCcuAdapter } from "./openccu-adapter.js";

vi.mock("./config.js", () => ({
  config: {
    ADMIN_PASSWORD: "test-admin-password-123",
    ADMIN_USERNAME: "admin",
    LOG_LEVEL: "silent",
    SESSION_TTL_MINUTES: 720,
    TRUSTED_PROXIES: "",
    LOCAL_NETWORKS: "127.0.0.0/8,192.168.0.0/16",
    RATE_LIMIT_PER_MINUTE: 300,
    RATE_LIMIT_MUTATIONS_PER_MINUTE: 60,
    RATE_LIMIT_GLOBAL_PER_MINUTE: 3000,
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_WINDOW_MINUTES: 15,
    LOGIN_BLOCK_MINUTES: 15,
    SALTA_HEALTH_TOKEN: "test-health-token-12345678901234567890"
  }
}));

vi.mock("./db.js", () => ({
  createRoom: vi.fn(),
  deleteRoom: vi.fn(),
  getGlobalShellyCredentials: vi.fn(),
  getPhosconSettings: vi.fn(async () => ({ baseUrl: "", apiKeyConfigured: false, encryptionStatus: "ok" })),
  getOpenCcuSettings: vi.fn(async () => ({ baseUrl: "", username: "", passwordConfigured: false, encryptionStatus: "ok" })),
  getShellySettings: vi.fn(),
  inspectCredentialEncryption: vi.fn(async () => ({ status: "ok", globalCredential: "not-configured", phosconCredential: "not-configured", openCcuCredential: "not-configured", invalidDeviceIds: [] })),
  listRooms: vi.fn(async () => []),
  pool: { query: vi.fn() },
  reorderRooms: vi.fn(),
  updateRoom: vi.fn(),
  updateShellySettings: vi.fn(),
  getPhosconConnection: vi.fn(),
  updatePhosconSettings: vi.fn(),
  clearPhosconSettings: vi.fn(),
  getOpenCcuConnection: vi.fn(),
  updateOpenCcuSettings: vi.fn(),
  clearOpenCcuSettings: vi.fn()
}));

import { deleteRoom, getGlobalShellyCredentials, getOpenCcuSettings, getPhosconSettings, reorderRooms, updateRoom } from "./db.js";
import { buildServer } from "./server.js";

const openServers: ReturnType<typeof buildServer>[] = [];

afterEach(async () => {
  await Promise.all(openServers.splice(0).map(server => server.close()));
});

function createServer(
  remove: ShellyAdapter["remove"],
  add: ShellyAdapter["add"] = vi.fn(),
  registryOverrides: Partial<DeviceRegistry> = {},
  phosconOverrides: Partial<PhosconAdapter> = {},
  openCcuOverrides: Partial<OpenCcuAdapter> = {}
) {
  const registry = {
    all: () => [],
    get: () => undefined,
    ...registryOverrides
  } as unknown as DeviceRegistry;
  const adapter = {
    remove,
    add,
    command: vi.fn(),
    reconcile: vi.fn()
  } as unknown as ShellyAdapter;
  const phoscon = {
    getStatus: vi.fn(() => ({ connected: false })),
    configure: vi.fn(),
    pair: vi.fn(),
    disconnect: vi.fn(),
    reconcile: vi.fn(),
    command: vi.fn(),
    ...phosconOverrides
  } as unknown as PhosconAdapter;
  const openCcu = {
    getStatus: vi.fn(() => ({ connected: false, interfaces: [], devices: 0 })),
    configure: vi.fn(),
    disconnect: vi.fn(),
    reconcile: vi.fn(),
    command: vi.fn(),
    ...openCcuOverrides
  } as unknown as OpenCcuAdapter;
  const server = buildServer(registry, adapter, phoscon, openCcu);
  openServers.push(server);
  return server;
}

const basicAuthorization = `Basic ${Buffer.from("admin:test-admin-password-123").toString("base64")}`;

function authenticatedInject(server: ReturnType<typeof buildServer>, options: InjectOptions) {
  return server.inject({
    ...options,
    headers: {
      authorization: basicAuthorization,
      ...options.headers
    }
  });
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

    const response = await authenticatedInject(server, {
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

    const response = await authenticatedInject(server, {
      method: "PUT",
      url: "/api/rooms/order",
      payload: { roomIds: orderedRooms.map(room => room.id) }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(orderedRooms);
    expect(reorderRooms).toHaveBeenCalledWith(orderedRooms.map(room => room.id));
  });
});


describe("DELETE /api/rooms/:id", () => {
  it("clears deleted room assignments from the in-memory registry", async () => {
    const roomId = "11111111-1111-4111-8111-111111111111";
    vi.mocked(deleteRoom).mockResolvedValueOnce(true);
    const clearRoom = vi.fn();
    const server = createServer(vi.fn(), vi.fn(), { clearRoom });

    const response = await authenticatedInject(server, {
      method: "DELETE",
      url: `/api/rooms/${roomId}`
    });

    expect(response.statusCode).toBe(204);
    expect(clearRoom).toHaveBeenCalledWith(roomId);
  });
});

describe("DELETE /api/devices/:id", () => {
  it("returns 204 after removing a Shelly device", async () => {
    const remove = vi.fn(async (): Promise<void> => undefined);
    const server = createServer(remove);

    const response = await authenticatedInject(server, {
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

    const response = await authenticatedInject(server, {
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

    const response = await authenticatedInject(server, {
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

    const response = await authenticatedInject(server, {
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


  it("hides a Zigbee device through its local SALTA configuration", async () => {
    const current = { id: "phoscon:lamp", source: "phoscon", type: "light", capabilities: ["turnOn", "turnOff"] };
    const updatedDevice = { ...current, hidden: true };
    const patch = vi.fn(async () => updatedDevice as never);
    const server = createServer(vi.fn(), vi.fn(), { get: () => current as never, patch });

    const response = await authenticatedInject(server, {
      method: "PATCH",
      url: "/api/devices/phoscon%3Alamp/config",
      payload: { hidden: true }
    });

    expect(response.statusCode).toBe(200);
    expect(patch).toHaveBeenCalledWith("phoscon:lamp", {
      hidden: true,
      roomId: undefined,
      room: undefined
    });
  });

  it("does not expose the Zigbee visibility flag for Shelly devices", async () => {
    const current = { id: "shelly:relay", source: "shelly", type: "switch", capabilities: ["turnOn", "turnOff"] };
    const patch = vi.fn();
    const server = createServer(vi.fn(), vi.fn(), { get: () => current as never, patch });

    const response = await authenticatedInject(server, {
      method: "PATCH",
      url: "/api/devices/shelly%3Arelay/config",
      payload: { hidden: true }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "VISIBILITY_NOT_SUPPORTED" } });
    expect(patch).not.toHaveBeenCalled();
  });

  it("rejects presentation overrides for non-switchable devices", async () => {
    const current = { id: "shelly:3em", type: "energyMeter", capabilities: [] };
    const patch = vi.fn();
    const server = createServer(vi.fn(), vi.fn(), { get: () => current as never, patch });

    const response = await authenticatedInject(server, {
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

    const response = await authenticatedInject(server, {
      method: "POST",
      url: "/api/adapters/shelly/devices",
      payload: { host: "192.168.1.50", credentialMode: "none", roomId: null }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ ...addedDevice, addedDevices: 1 });
    expect(add).toHaveBeenCalledWith("192.168.1.50", "", "", undefined, undefined, undefined, "none");
  });

  it("keeps Shelly credential failures separate from SALTA session authentication", async () => {
    const add = vi.fn(async () => { throw new Error("AUTHENTICATION_FAILED"); });
    const server = createServer(vi.fn(), add);

    const response = await authenticatedInject(server, {
      method: "POST",
      url: "/api/adapters/shelly/devices",
      payload: { host: "192.168.1.60", credentialMode: "custom", username: "admin", password: "wrong" }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: {
        code: "AUTHENTICATION_FAILED",
        message: "Authentication failed. Check the selected Shelly credentials."
      }
    });
  });

  it("returns a readable error when the Shelly is unreachable", async () => {
    const add = vi.fn(async () => { throw new Error("DEVICE_UNREACHABLE"); });
    const server = createServer(vi.fn(), add);

    const response = await authenticatedInject(server, {
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

    const response = await authenticatedInject(server, {
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

    const response = await authenticatedInject(server, {
      method: "POST",
      url: "/api/adapters/shelly/devices",
      payload: { host: "192.168.1.50", credentialMode: "custom", password: "secret" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "USERNAME_REQUIRED" } });
    expect(add).not.toHaveBeenCalled();
  });
});

describe("Phoscon settings API", () => {
  it("returns stored connection metadata and live gateway status", async () => {
    vi.mocked(getPhosconSettings).mockResolvedValueOnce({
      baseUrl: "http://phoscon.local:8080",
      apiKeyConfigured: true,
      encryptionStatus: "ok"
    });
    const getStatus = vi.fn(() => ({ connected: true, name: "Phoscon-GW", zigbeeChannel: 15 }));
    const server = createServer(vi.fn(), vi.fn(), {}, { getStatus } as never);

    const response = await authenticatedInject(server, {
      method: "GET",
      url: "/api/settings/phoscon"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      baseUrl: "http://phoscon.local:8080",
      apiKeyConfigured: true,
      encryptionStatus: "ok",
      gateway: { connected: true, name: "Phoscon-GW", zigbeeChannel: 15 }
    });
  });

  it("maps a locked gateway pairing response to a readable conflict", async () => {
    const pair = vi.fn(async () => { throw new Error("PHOSCON_GATEWAY_LOCKED"); });
    const server = createServer(vi.fn(), vi.fn(), {}, { pair } as never);

    const response = await authenticatedInject(server, {
      method: "POST",
      url: "/api/settings/phoscon/pair",
      payload: { baseUrl: "http://192.168.178.20:8080" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "PHOSCON_GATEWAY_LOCKED" } });
    expect(pair).toHaveBeenCalledWith("http://192.168.178.20:8080");
  });

  it("rejects manual Zigbee synchronization before Phoscon is configured", async () => {
    vi.mocked(getPhosconSettings).mockResolvedValueOnce({
      baseUrl: "",
      apiKeyConfigured: false,
      encryptionStatus: "ok"
    });
    const reconcile = vi.fn();
    const server = createServer(vi.fn(), vi.fn(), {}, { reconcile } as never);

    const response = await authenticatedInject(server, {
      method: "POST",
      url: "/api/adapters/phoscon/reconcile"
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "PHOSCON_NOT_CONFIGURED" } });
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("disconnects Phoscon without deleting devices from the gateway", async () => {
    const disconnect = vi.fn(async () => undefined);
    const server = createServer(vi.fn(), vi.fn(), {}, { disconnect } as never);

    const response = await authenticatedInject(server, {
      method: "DELETE",
      url: "/api/settings/phoscon"
    });

    expect(response.statusCode).toBe(204);
    expect(disconnect).toHaveBeenCalledOnce();
  });
});

describe("OpenCCU settings API", () => {
  it("returns stored connection metadata without exposing the password", async () => {
    vi.mocked(getOpenCcuSettings).mockResolvedValueOnce({
      baseUrl: "http://openccu.local",
      username: "salta",
      passwordConfigured: true,
      encryptionStatus: "ok"
    });
    const getStatus = vi.fn(() => ({ connected: true, interfaces: ["HmIP-RF"], devices: 4 }));
    const server = createServer(vi.fn(), vi.fn(), {}, {}, { getStatus } as never);

    const response = await authenticatedInject(server, { method: "GET", url: "/api/settings/openccu" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      baseUrl: "http://openccu.local",
      username: "salta",
      passwordConfigured: true,
      encryptionStatus: "ok",
      gateway: { connected: true, interfaces: ["HmIP-RF"], devices: 4 }
    });
    expect(response.json()).not.toHaveProperty("password");
  });

  it("validates and stores an OpenCCU connection through the adapter", async () => {
    const configure = vi.fn(async () => ({ connected: true, interfaces: ["BidCos-RF", "HmIP-RF"], devices: 2 }));
    vi.mocked(getOpenCcuSettings).mockResolvedValueOnce({
      baseUrl: "http://openccu.local",
      username: "salta",
      passwordConfigured: true,
      encryptionStatus: "ok"
    });
    const server = createServer(vi.fn(), vi.fn(), {}, {}, { configure } as never);

    const response = await authenticatedInject(server, {
      method: "PUT",
      url: "/api/settings/openccu",
      payload: { baseUrl: "http://openccu.local", username: "salta", password: "secret-password" }
    });

    expect(response.statusCode).toBe(200);
    expect(configure).toHaveBeenCalledWith("http://openccu.local", "salta", "secret-password");
  });
});

describe("web security", () => {
  it("redirects unauthenticated browser requests to the login page", async () => {
    const server = createServer(vi.fn());
    const response = await server.inject({ method: "GET", url: "/" });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/login");
  });

  it("serves the login assets without authentication", async () => {
    const server = createServer(vi.fn());
    const stylesheet = await server.inject({ method: "GET", url: "/login.css" });
    const script = await server.inject({ method: "GET", url: "/login.js" });

    expect(stylesheet.statusCode).toBe(200);
    expect(stylesheet.headers["content-type"]).toContain("text/css");
    expect(script.statusCode).toBe(200);
    expect(script.headers["content-type"]).toContain("text/javascript");
  });

  it("serves allow-listed application assets after authentication", async () => {
    const server = createServer(vi.fn());
    const response = await authenticatedInject(server, { method: "GET", url: "/styles.css" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/css");
  });

  it("protects health and readiness API routes", async () => {
    const server = createServer(vi.fn());
    const response = await server.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("rejects forwarded headers when no trusted proxy is configured", async () => {
    const server = createServer(vi.fn());
    const response = await server.inject({ method: "GET", url: "/login", headers: { "x-forwarded-for": "203.0.113.10", "x-forwarded-proto": "https" } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "TRUSTED_PROXY_REQUIRED" } });
  });


  it("rejects Basic API authentication from non-local client addresses", async () => {
    const server = createServer(vi.fn());
    const response = await server.inject({
      method: "GET",
      url: "/api/health",
      remoteAddress: "203.0.113.20",
      headers: { authorization: basicAuthorization }
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("rejects cross-origin remote login attempts", async () => {
    const server = createServer(vi.fn());
    const response = await server.inject({
      method: "POST",
      url: "/auth/login",
      remoteAddress: "203.0.113.20",
      headers: { origin: "https://evil.example" },
      payload: { username: "admin", password: "test-admin-password-123" }
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "ORIGIN_VALIDATION_FAILED" } });
  });

  it("allows the internal health check only with its secret token", async () => {
    const server = createServer(vi.fn());
    const denied = await server.inject({ method: "GET", url: "/internal/health" });
    expect(denied.statusCode).toBe(404);
    const allowed = await server.inject({ method: "GET", url: "/internal/health", headers: { "x-salta-health-token": "test-health-token-12345678901234567890" } });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({ status: "ok", version: "0.7.0" });
  });

  it("creates an HttpOnly session and requires CSRF for state-changing requests", async () => {
    const server = createServer(vi.fn());
    const login = await server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "admin", password: "test-admin-password-123" }
    });
    expect(login.statusCode).toBe(200);
    const cookie = String(login.headers["set-cookie"]).split(";", 1)[0];
    expect(String(login.headers["set-cookie"])).toContain("HttpOnly");
    expect(String(login.headers["set-cookie"])).toContain("SameSite=Strict");

    const session = await server.inject({ method: "GET", url: "/auth/session", headers: { cookie } });
    expect(session.statusCode).toBe(200);
    const csrfToken = session.json().csrfToken as string;

    const denied = await server.inject({ method: "PUT", url: "/api/rooms/order", headers: { cookie }, payload: { roomIds: [] } });
    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toMatchObject({ error: { code: "CSRF_VALIDATION_FAILED" } });

    vi.mocked(reorderRooms).mockResolvedValueOnce([]);
    const allowed = await server.inject({ method: "PUT", url: "/api/rooms/order", headers: { cookie, "x-salta-csrf": csrfToken }, payload: { roomIds: [] } });
    expect(allowed.statusCode).toBe(200);
  });
});
