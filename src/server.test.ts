import type { InjectOptions } from "light-my-request";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeviceRegistry } from "./registry.js";
import type { ShellyAdapter } from "./shelly-adapter.js";
import type { PhosconAdapter } from "./phoscon-adapter.js";
import type { HueAdapter } from "./hue-adapter.js";
import type { OpenCcuAdapter } from "./openccu-adapter.js";
import type { VirtualDeviceAdapter } from "./virtual-adapter.js";
import type { AutomationEngine } from "./automations.js";
import type { ClimateModeManager } from "./climate-mode.js";
import type { HomeKitBridge } from "./homekit.js";

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
    SALTA_HEALTH_TOKEN: "test-health-token-12345678901234567890",
    SALTA_ENCRYPTION_KEY: "test-backup-encryption-key-123456"
  }
}));

vi.mock("./db.js", () => ({
  createRoom: vi.fn(),
  deleteRoom: vi.fn(),
  getGlobalShellyCredentials: vi.fn(),
  getPhosconSettings: vi.fn(async () => ({ baseUrl: "", apiKeyConfigured: false, encryptionStatus: "ok" })),
  getHueSettings: vi.fn(async () => ({ baseUrl: "", applicationKeyConfigured: false, encryptionStatus: "ok" })),
  getOpenCcuSettings: vi.fn(async () => ({ baseUrl: "", username: "", passwordConfigured: false, encryptionStatus: "ok" })),
  getFritzBoxPresenceSettings: vi.fn(async () => ({ baseUrl: "http://fritz.box:49000", username: "", passwordConfigured: false, encryptionStatus: "ok", enabled: false, pollIntervalSeconds: 30, absenceDelaySeconds: 300, tlsInsecure: false })),
  getFritzBoxPresenceConnection: vi.fn(async () => ({ baseUrl: "http://fritz.box:49000", username: "", password: "", enabled: false, pollIntervalSeconds: 30, absenceDelaySeconds: 300, tlsInsecure: false })),
  listPresenceTargets: vi.fn(async () => []),
  createPresenceTarget: vi.fn(),
  updatePresenceTarget: vi.fn(),
  deletePresenceTarget: vi.fn(),
  updateFritzBoxPresenceSettings: vi.fn(),
  getShellySettings: vi.fn(),
  getGeneralSettings: vi.fn(async () => ({ debugLevel: "off" })),
  updateGeneralSettings: vi.fn(async (input) => input),
  getPushoverSettings: vi.fn(async () => ({ enabled: false, userKeyConfigured: false, apiTokenConfigured: false, encryptionStatus: "ok", batteryThreshold: 20 })),
  updatePushoverSettings: vi.fn(async () => ({ enabled: false, userKeyConfigured: false, apiTokenConfigured: false, encryptionStatus: "ok", batteryThreshold: 20 })),
  inspectCredentialEncryption: vi.fn(async () => ({ status: "ok", globalCredential: "not-configured", phosconCredential: "not-configured", hueCredential: "not-configured", openCcuCredential: "not-configured", pushoverCredential: "not-configured", invalidDeviceIds: [] })),
  listRooms: vi.fn(async () => []),
  pool: { query: vi.fn() },
  reorderRooms: vi.fn(),
  updateRoom: vi.fn(),
  updateShellySettings: vi.fn(),
  getPhosconConnection: vi.fn(),
  updatePhosconSettings: vi.fn(),
  clearPhosconSettings: vi.fn(),
  getHueConnection: vi.fn(),
  updateHueSettings: vi.fn(),
  clearHueSettings: vi.fn(),
  getOpenCcuConnection: vi.fn(),
  updateOpenCcuSettings: vi.fn(),
  clearOpenCcuSettings: vi.fn(),
  listSystemLogs: vi.fn(async () => []),
  clearSystemLogs: vi.fn(async () => undefined),
  writeSystemLog: vi.fn(async () => undefined)
}));

vi.mock("./disaster-recovery-backup.js", () => ({
  createDisasterRecoveryBackup: vi.fn(),
  importDisasterRecoveryBackup: vi.fn()
}));

import { createDisasterRecoveryBackup, importDisasterRecoveryBackup } from "./disaster-recovery-backup.js";
import { clearSystemLogs, deleteRoom, getGeneralSettings, getGlobalShellyCredentials, getHueSettings, getOpenCcuSettings, getPhosconSettings, listRooms, listSystemLogs, reorderRooms, updateGeneralSettings, updateRoom } from "./db.js";
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
  openCcuOverrides: Partial<OpenCcuAdapter> = {},
  virtualOverrides: Partial<VirtualDeviceAdapter> = {},
  automationOverrides: Partial<AutomationEngine> = {},
  climateMode?: ClimateModeManager,
  restartAfterConfigurationImport?: () => void,
  homeKitBridge?: HomeKitBridge,
  hueOverrides: Partial<HueAdapter> = {}
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
  const hue = {
    getStatus: vi.fn(() => ({ connected: false })),
    configure: vi.fn(),
    discover: vi.fn(async () => []),
    pair: vi.fn(),
    disconnect: vi.fn(),
    reconcile: vi.fn(),
    command: vi.fn(),
    ...hueOverrides
  } as unknown as HueAdapter;
  const openCcu = {
    getStatus: vi.fn(() => ({ connected: false, interfaces: [], devices: 0 })),
    configure: vi.fn(),
    disconnect: vi.fn(),
    reconcile: vi.fn(),
    diagnose: vi.fn(),
    command: vi.fn(),
    ...openCcuOverrides
  } as unknown as OpenCcuAdapter;
  const virtual = {
    createSwitch: vi.fn(),
    createButton: vi.fn(),
    updateKind: vi.fn(),
    remove: vi.fn(),
    command: vi.fn(),
    ...virtualOverrides
  } as unknown as VirtualDeviceAdapter;
  const automation = {
    list: vi.fn(() => []),
    create: vi.fn(),
    update: vi.fn(),
    setEnabled: vi.fn(),
    remove: vi.fn(),
    clearRoomAssignment: vi.fn(),
    ...automationOverrides
  } as unknown as AutomationEngine;
  const server = buildServer(registry, adapter, phoscon, openCcu, virtual, undefined, automation, undefined, climateMode, undefined, restartAfterConfigurationImport, homeKitBridge, hue);
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


describe("HomeKit settings API", () => {
  function homeKitStatus(overrides: Record<string, unknown> = {}) {
    return {
      enabled: false, name: "SALTA Bridge", pin: "031-45-154", username: "02:42:53:41:4C:54", networkInterface: "", encryptionStatus: "ok",
      running: false, paired: false, advertised: false, port: 51826, setupUri: "X-HM://0023ISYWY9SKP", supportedDevices: 4, publishedDevices: 2, networkInterfaces: [{ name: "eth0", addresses: ["192.168.178.10"] }],
      ...overrides
    };
  }

  it("returns authenticated HomeKit status without exposing a pairing code after pairing", async () => {
    const status = vi.fn(async () => homeKitStatus({ enabled: true, running: true, paired: true, advertised: true, listeningPort: 51826 }));
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, {}, undefined, undefined, { status } as unknown as HomeKitBridge);
    const response = await authenticatedInject(server, { method: "GET", url: "/api/settings/homekit" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ enabled: true, running: true, paired: true, advertised: true, listeningPort: 51826, port: 51826 });
    expect(response.json()).not.toHaveProperty("pairingCode");
    expect(response.json()).not.toHaveProperty("setupUri");
    expect(response.json()).not.toHaveProperty("pin");
  });

  it("applies HomeKit configuration live and returns the pairing code only while unpaired", async () => {
    const configure = vi.fn(async () => homeKitStatus({ enabled: true, running: true, paired: false, advertised: true, listeningPort: 51826 }));
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, {}, undefined, undefined, { configure } as unknown as HomeKitBridge);
    const response = await authenticatedInject(server, { method: "PUT", url: "/api/settings/homekit", payload: { enabled: true, name: "SALTA Zuhause", networkInterface: "eth0" } });
    expect(response.statusCode).toBe(200);
    expect(configure).toHaveBeenCalledWith({ enabled: true, name: "SALTA Zuhause", networkInterface: "eth0" });
    expect(response.json()).toMatchObject({ enabled: true, pairingCode: "031-45-154", setupUri: "X-HM://0023ISYWY9SKP" });
    expect(response.json()).not.toHaveProperty("pin");
  });

  it("resets HomeKit pairing through a separately rate-limited endpoint", async () => {
    const resetPairing = vi.fn(async () => homeKitStatus({ enabled: true, running: true, paired: false, advertised: true, pin: "123-45-678" }));
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, {}, undefined, undefined, { resetPairing } as unknown as HomeKitBridge);
    const response = await authenticatedInject(server, { method: "POST", url: "/api/settings/homekit/reset" });
    expect(response.statusCode).toBe(200);
    expect(resetPairing).toHaveBeenCalledTimes(1);
    expect(response.json()).toMatchObject({ paired: false, pairingCode: "123-45-678", setupUri: "X-HM://0023ISYWY9SKP" });
  });
});

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

  it("stores HomeKit publication settings while inheriting the SALTA room by default", async () => {
    const room = { id: "11111111-1111-4111-8111-111111111111", name: "Wohnzimmer", icon: "sofa-outline", sortOrder: 0, createdAt: "2026-08-12T00:00:00.000Z", updatedAt: "2026-08-12T00:00:00.000Z" };
    vi.mocked(listRooms).mockResolvedValueOnce([room]);
    const current = { id: "shelly:tv", source: "shelly", type: "switch", name: "TV", roomId: room.id, room: room.name, capabilities: ["turnOn", "turnOff"], homekitEnabled: true };
    const patch = vi.fn(async () => current as never);
    const patchHomeKit = vi.fn(async () => ({ ...current, homekitName: "Fernseher", homekitUseSaltaRoom: true, homekitRoomId: room.id, homekitRoom: room.name }) as never);
    const server = createServer(vi.fn(), vi.fn(), { get: () => current as never, patch, patchHomeKit });
    const response = await authenticatedInject(server, { method: "PATCH", url: "/api/devices/shelly%3Atv/config", payload: { name: "TV", roomId: room.id, homekitEnabled: true, homekitName: "Fernseher", homekitUseSaltaRoom: true, homekitRoomId: null } });
    expect(response.statusCode).toBe(200);
    expect(patchHomeKit).toHaveBeenCalledWith("shelly:tv", { enabled: true, name: "Fernseher", useSaltaRoom: true, roomId: undefined, room: undefined });
  });

  it("rejects HomeKit publication for device types not implemented by the bridge", async () => {
    const current = { id: "shelly:3em", source: "shelly", type: "energyMeter", capabilities: [], homekitEnabled: false };
    const patch = vi.fn();const patchHomeKit = vi.fn();
    const server = createServer(vi.fn(), vi.fn(), { get: () => current as never, patch, patchHomeKit });
    const response = await authenticatedInject(server, { method: "PATCH", url: "/api/devices/shelly%3A3em/config", payload: { homekitEnabled: true } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "HOMEKIT_NOT_SUPPORTED" } });
    expect(patch).not.toHaveBeenCalled();expect(patchHomeKit).not.toHaveBeenCalled();
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

describe("Philips Hue settings API", () => {
  it("returns stored Hue metadata and live bridge status without exposing the application key", async () => {
    vi.mocked(getHueSettings).mockResolvedValueOnce({
      baseUrl: "https://192.168.178.25",
      applicationKeyConfigured: true,
      encryptionStatus: "ok"
    });
    const getStatus = vi.fn(() => ({ connected: true, name: "Hue Bridge", bridgeId: "001788FFFE123456", realtimeConnected: true }));
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, {}, undefined, undefined, undefined, { getStatus } as never);

    const response = await authenticatedInject(server, { method: "GET", url: "/api/settings/hue" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      baseUrl: "https://192.168.178.25",
      applicationKeyConfigured: true,
      encryptionStatus: "ok",
      gateway: { connected: true, name: "Hue Bridge", bridgeId: "001788FFFE123456", realtimeConnected: true }
    });
    expect(response.json()).not.toHaveProperty("applicationKey");
  });

  it("discovers local Hue Bridges through the adapter without exposing credentials", async () => {
    const bridges = [{ address: "192.168.178.25", baseUrl: "https://192.168.178.25", name: "Philips Hue", bridgeId: "001788FFFE123456" }];
    const discover = vi.fn(async () => bridges);
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, {}, undefined, undefined, undefined, { discover } as never);

    const response = await authenticatedInject(server, { method: "POST", url: "/api/settings/hue/discover" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ bridges });
    expect(discover).toHaveBeenCalledOnce();
  });

  it("maps the physical-link-button requirement to a readable Hue pairing conflict", async () => {
    const pair = vi.fn(async () => { throw new Error("HUE_LINK_BUTTON_REQUIRED"); });
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, {}, undefined, undefined, undefined, { pair } as never);

    const response = await authenticatedInject(server, {
      method: "POST",
      url: "/api/settings/hue/pair",
      payload: { baseUrl: "https://192.168.178.25" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "HUE_LINK_BUTTON_REQUIRED" } });
    expect(pair).toHaveBeenCalledWith("https://192.168.178.25");
  });

  it("rejects manual Hue synchronization before the bridge is configured", async () => {
    vi.mocked(getHueSettings).mockResolvedValueOnce({ baseUrl: "", applicationKeyConfigured: false, encryptionStatus: "ok" });
    const reconcile = vi.fn();
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, {}, undefined, undefined, undefined, { reconcile } as never);

    const response = await authenticatedInject(server, { method: "POST", url: "/api/adapters/hue/reconcile" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "HUE_NOT_CONFIGURED" } });
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("disconnects Hue without changing the bridge-side pairing of lights", async () => {
    const disconnect = vi.fn(async () => undefined);
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, {}, undefined, undefined, undefined, { disconnect } as never);

    const response = await authenticatedInject(server, { method: "DELETE", url: "/api/settings/hue" });

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



  it("runs OpenCCU diagnostics inside SALTA and returns the method report", async () => {
    const report = {
      ok: true,
      startedAt: "2026-07-24T10:00:00.000Z",
      completedAt: "2026-07-24T10:00:01.000Z",
      baseUrl: "http://openccu.local",
      interfaces: ["HmIP-RF"],
      steps: [
        { method: "Session.login", status: "ok", durationMs: 20 },
        { method: "Device.listAllDetail", status: "warning", durationMs: 30, code: "OPENCCU_API_ERROR", message: "TCL error" }
      ]
    };
    const diagnose = vi.fn(async () => report);
    const server = createServer(vi.fn(), vi.fn(), {}, {}, { diagnose } as never);

    const response = await authenticatedInject(server, {
      method: "POST",
      url: "/api/settings/openccu/diagnose",
      payload: { baseUrl: "http://openccu.local", username: "salta", password: "secret-password" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ report });
    expect(diagnose).toHaveBeenCalledWith("http://openccu.local", "salta", "secret-password");
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


describe("general settings API", () => {
  it("reads and updates the global DEBUG level", async () => {
    vi.mocked(getGeneralSettings).mockResolvedValueOnce({ debugLevel: "errors" });
    vi.mocked(updateGeneralSettings).mockResolvedValueOnce({ debugLevel: "verbose" });
    const server = createServer(vi.fn());

    const readResponse = await authenticatedInject(server, { method: "GET", url: "/api/settings/general" });
    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json()).toEqual({ debugLevel: "errors" });

    const writeResponse = await authenticatedInject(server, { method: "PUT", url: "/api/settings/general", payload: { debugLevel: "verbose" } });
    expect(writeResponse.statusCode).toBe(200);
    expect(updateGeneralSettings).toHaveBeenCalledWith({ debugLevel: "verbose" });
  });

  it("rejects unsupported DEBUG levels", async () => {
    const server = createServer(vi.fn());
    const response = await authenticatedInject(server, { method: "PUT", url: "/api/settings/general", payload: { debugLevel: "trace" } });
    expect(response.statusCode).toBe(400);
  });
});

describe("climate mode API", () => {
  it("stores the winter target mode without applying thermostat commands", async () => {
    const status = vi.fn(async () => ({ mode: "winter", winterMode: "auto", thermostats: 2, supportedThermostats: 2 }));
    const setWinterMode = vi.fn(async (winterMode: "manual" | "auto") => ({ mode: "winter", winterMode, thermostats: 2, supportedThermostats: 2 }));
    const apply = vi.fn();
    const climate = { status, setWinterMode, apply } as unknown as ClimateModeManager;
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, {}, climate);

    const response = await authenticatedInject(server, {
      method: "PUT",
      url: "/api/settings/climate-mode",
      payload: { winterMode: "manual" }
    });

    expect(response.statusCode).toBe(200);
    expect(setWinterMode).toHaveBeenCalledWith("manual");
    expect(apply).not.toHaveBeenCalled();
  });

  it("applies the selected global mode using the stored winter configuration", async () => {
    const apply = vi.fn(async (mode: "summer" | "winter") => ({ mode, winterMode: "manual", thermostats: 2, supportedThermostats: 2 }));
    const climate = { status: vi.fn(), setWinterMode: vi.fn(), apply } as unknown as ClimateModeManager;
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, {}, climate);

    const response = await authenticatedInject(server, {
      method: "PUT",
      url: "/api/system/climate-mode",
      payload: { mode: "winter" }
    });

    expect(response.statusCode).toBe(200);
    expect(apply).toHaveBeenCalledWith("winter");
  });
});

describe("system log API", () => {
  it("returns filtered persistent log entries", async () => {
    const entries = [{ id: "11111111-1111-4111-8111-111111111111", level: "error", source: "openccu", code: "OPENCCU_API_ERROR", message: "OpenCCU synchronization failed", details: { method: "Device.listAllDetail" }, createdAt: "2026-07-24T10:00:00.000Z" }];
    vi.mocked(listSystemLogs).mockResolvedValueOnce(entries as never);
    const server = createServer(vi.fn());

    const response = await authenticatedInject(server, { method: "GET", url: "/api/logs?source=openccu&level=error&limit=50" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ entries });
    expect(listSystemLogs).toHaveBeenCalledWith(50, "openccu", "error");
  });

  it("defaults to 100 entries and rejects larger log requests", async () => {
    vi.mocked(listSystemLogs).mockClear();
    const server = createServer(vi.fn());

    const defaultResponse = await authenticatedInject(server, { method: "GET", url: "/api/logs" });
    expect(defaultResponse.statusCode).toBe(200);
    expect(listSystemLogs).toHaveBeenCalledWith(100, undefined, undefined);

    const oversizedResponse = await authenticatedInject(server, { method: "GET", url: "/api/logs?limit=101" });
    expect(oversizedResponse.statusCode).toBe(400);
  });

  it("clears the persistent system log", async () => {
    const server = createServer(vi.fn());
    const response = await authenticatedInject(server, { method: "DELETE", url: "/api/logs" });
    expect(response.statusCode).toBe(204);
    expect(clearSystemLogs).toHaveBeenCalled();
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

  it("serves current application assets without stale browser caching", async () => {
    const server = createServer(vi.fn());
    const stylesheet = await authenticatedInject(server, { method: "GET", url: "/styles.css" });
    const application = await authenticatedInject(server, { method: "GET", url: "/app.js" });
    const homeKitQr = await authenticatedInject(server, { method: "GET", url: "/homekit-qr.js" });
    const roomGrouping = await authenticatedInject(server, { method: "GET", url: "/room-grouping.js" });

    expect(stylesheet.statusCode).toBe(200);
    expect(stylesheet.headers["content-type"]).toContain("text/css");
    expect(stylesheet.headers["cache-control"]).toBe("no-store");
    expect(application.statusCode).toBe(200);
    expect(application.headers["content-type"]).toContain("text/javascript");
    expect(application.headers["cache-control"]).toBe("no-store");
    expect(homeKitQr.statusCode).toBe(200);
    expect(homeKitQr.headers["content-type"]).toContain("text/javascript");
    expect(homeKitQr.headers["cache-control"]).toBe("no-store");
    expect(homeKitQr.body).toContain("renderHomeKitSetupQrSvg");
    expect(homeKitQr.body).not.toContain("<!doctype html>");
    expect(roomGrouping.statusCode).toBe(200);
    expect(roomGrouping.headers["content-type"]).toContain("text/javascript");
    expect(roomGrouping.headers["cache-control"]).toBe("no-store");
  });

  it("keeps versioned vendor assets immutable", async () => {
    const server = createServer(vi.fn());
    const response = await authenticatedInject(server, { method: "GET", url: "/vendor/mdi/materialdesignicons.min.css" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
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
    expect(allowed.json()).toMatchObject({ status: "ok", version: "0.8.80" });
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


describe("automations", () => {
  it("creates a device-state automation with a room, optional condition and toggle action", async () => {
    const room = { id: "22222222-2222-4222-8222-222222222222", name: "Hallway", icon: "door-open", sortOrder: 0, createdAt: "2026-08-09T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z" };
    vi.mocked(listRooms).mockResolvedValueOnce([room]);
    const created = { id: "11111111-1111-4111-8111-111111111111", name: "Motion light", enabled: true, roomId: room.id, triggerDeviceId: "motion", triggerStateKey: "motion", triggerValue: true, additionalTriggers: [{ deviceId: "wall-switch", stateKey: "on", value: true }], conditionDeviceId: "guard", conditionStateKey: "on", conditionValue: false, additionalConditions: [{ deviceId: "door", stateKey: "open", value: false }], actionDeviceId: "light", action: "toggle", additionalActions: [{ deviceId: "fan", action: "turnOn" }], createdAt: "2026-08-09T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z" };
    const create = vi.fn(async () => created as never);
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, { create });
    const response = await authenticatedInject(server, { method: "POST", url: "/api/automations", payload: { name: "Motion light", enabled: true, roomId: room.id, triggerDeviceId: "motion", triggerStateKey: "motion", triggerValue: true, additionalTriggers: [{ deviceId: "wall-switch", stateKey: "on", value: true }], conditionDeviceId: "guard", conditionStateKey: "on", conditionValue: false, additionalConditions: [{ deviceId: "door", stateKey: "open", value: false }], actionDeviceId: "light", action: "toggle", additionalActions: [{ deviceId: "fan", action: "turnOn" }] } });
    expect(response.statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ roomId: room.id, triggerValue: true, additionalTriggers: [{ deviceId: "wall-switch", stateKey: "on", value: true }], conditionValue: false, additionalConditions: [{ deviceId: "door", stateKey: "open", value: false }], action: "toggle", additionalActions: [{ deviceId: "fan", action: "turnOn" }] }));
  });

  it("accepts a daily local-time automation trigger without a trigger device", async () => {
    const created = { id: "rule-time", name: "Morning light", enabled: true, triggerType: "time", triggerTime: "07:30", triggerDeviceId: "light", triggerStateKey: "__time__", triggerValue: true, actionDeviceId: "light", action: "turnOn", createdAt: "2026-08-15T00:00:00.000Z", updatedAt: "2026-08-15T00:00:00.000Z" };
    const create = vi.fn(async () => created as never);
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, { create });
    const response = await authenticatedInject(server, { method: "POST", url: "/api/automations", payload: { name: "Morning light", enabled: true, triggerType: "time", triggerTime: "07:30", actionDeviceId: "light", action: "turnOn" } });
    expect(response.statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ triggerType: "time", triggerTime: "07:30", triggerDeviceId: "light", triggerStateKey: "__time__", triggerValue: true, additionalTriggers: [] }));
  });

  it("accepts the SALTA heating mode as a time-trigger target", async () => {
    const created = { id: "rule-climate", name: "Night heating", enabled: true, triggerType: "time", triggerTime: "22:00", triggerDeviceId: "system:climate-mode", triggerStateKey: "__time__", triggerValue: true, actionDeviceId: "system:climate-mode", action: "climateWinter", createdAt: "2026-08-15T00:00:00.000Z", updatedAt: "2026-08-15T00:00:00.000Z" };
    const create = vi.fn(async () => created as never);
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, { create });
    const response = await authenticatedInject(server, { method: "POST", url: "/api/automations", payload: { name: "Night heating", enabled: true, triggerType: "time", triggerTime: "22:00", actionDeviceId: "system:climate-mode", action: "climateWinter" } });
    expect(response.statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ triggerType: "time", triggerTime: "22:00", triggerDeviceId: "system:climate-mode", triggerStateKey: "__time__", triggerValue: true, actionDeviceId: "system:climate-mode", action: "climateWinter" }));
  });

  it("accepts OpenCCU cover and thermostat target actions", async () => {
    const created = { id: "rule-openccu", name: "OpenCCU targets", enabled: true, triggerDeviceId: "motion", triggerStateKey: "motion", triggerValue: true, actionDeviceId: "cover", action: "open", additionalActions: [{ deviceId: "thermostat", action: "thermostatAuto" }], createdAt: "2026-08-15T00:00:00.000Z", updatedAt: "2026-08-15T00:00:00.000Z" };
    const create = vi.fn(async () => created as never);
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, { create });
    const response = await authenticatedInject(server, { method: "POST", url: "/api/automations", payload: { name: "OpenCCU targets", enabled: true, triggerDeviceId: "motion", triggerStateKey: "motion", triggerValue: true, actionDeviceId: "cover", action: "open", additionalActions: [{ deviceId: "thermostat", action: "thermostatAuto" }] } });
    expect(response.statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ action: "open", additionalActions: [{ deviceId: "thermostat", action: "thermostatAuto" }] }));
  });

  it("accepts thermostat target-temperature values for primary and additional actions", async () => {
    const created = { id: "rule-temperature", name: "Thermostat temperatures", enabled: true, triggerDeviceId: "motion", triggerStateKey: "motion", triggerValue: true, actionDeviceId: "thermostat-a", action: "setTargetTemperature", actionValue: 22.5, additionalActions: [{ deviceId: "thermostat-b", action: "setTargetTemperature", value: 19.5 }], createdAt: "2026-08-15T00:00:00.000Z", updatedAt: "2026-08-15T00:00:00.000Z" };
    const create = vi.fn(async () => created as never);
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, { create });
    const response = await authenticatedInject(server, { method: "POST", url: "/api/automations", payload: { name: "Thermostat temperatures", enabled: true, triggerDeviceId: "motion", triggerStateKey: "motion", triggerValue: true, actionDeviceId: "thermostat-a", action: "setTargetTemperature", actionValue: 22.5, additionalActions: [{ deviceId: "thermostat-b", action: "setTargetTemperature", value: 19.5 }] } });
    expect(response.statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ action: "setTargetTemperature", actionValue: 22.5, additionalActions: [{ deviceId: "thermostat-b", action: "setTargetTemperature", value: 19.5 }] }));
  });

  it("rejects thermostat temperature actions without a temperature", async () => {
    const create = vi.fn();
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, { create });
    const response = await authenticatedInject(server, { method: "POST", url: "/api/automations", payload: { name: "Missing temperature", enabled: true, triggerDeviceId: "motion", triggerStateKey: "motion", triggerValue: true, actionDeviceId: "thermostat-a", action: "setTargetTemperature" } });
    expect(response.statusCode).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a room assignment that no longer exists", async () => {
    vi.mocked(listRooms).mockResolvedValueOnce([]);
    const create = vi.fn();
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, { create });
    const response = await authenticatedInject(server, { method: "POST", url: "/api/automations", payload: { name: "Missing room", enabled: true, roomId: "22222222-2222-4222-8222-222222222222", triggerDeviceId: "motion", triggerStateKey: "motion", triggerValue: true, actionDeviceId: "light", action: "toggle" } });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: "AUTOMATION_ROOM_NOT_FOUND" } });
    expect(create).not.toHaveBeenCalled();
  });

  it("toggles an automation enabled state through its dedicated endpoint", async () => {
    const setEnabled = vi.fn(async () => ({ id: "rule", enabled: false } as never));
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, { setEnabled });
    const response = await authenticatedInject(server, { method: "PATCH", url: "/api/automations/rule/enabled", payload: { enabled: false } });
    expect(response.statusCode).toBe(200);
    expect(setEnabled).toHaveBeenCalledWith("rule", false);
  });
});

describe("virtual devices", () => {
  it("creates a virtual switch with an optional SALTA room assignment", async () => {
    const room = { id: "11111111-1111-4111-8111-111111111111", name: "Living room", icon: "sofa-outline", sortOrder: 0, createdAt: "2026-08-09T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z" };
    vi.mocked(listRooms).mockResolvedValueOnce([room]);
    const created = { id: "virtual:test", source: "virtual", sourceId: "test", type: "switch", name: "Guest mode", roomId: room.id, room: room.name, reachable: true, state: { on: false }, capabilities: ["toggle", "turnOn", "turnOff"], homekitEnabled: true, hidden: false, credentialMode: "none", passwordConfigured: false, lastSeen: room.createdAt, lastEvent: room.createdAt };
    const createSwitch = vi.fn(async () => created as never);
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, { createSwitch });
    const response = await authenticatedInject(server, { method: "POST", url: "/api/adapters/virtual/devices", payload: { name: "Guest mode", type: "switch", roomId: room.id } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ source: "virtual", type: "switch", name: "Guest mode", homekitEnabled: true });
    expect(createSwitch).toHaveBeenCalledWith("Guest mode", room.id, room.name);
  });

  it("creates a momentary virtual button for HomeKit/geofence triggers", async () => {
    const created = { id: "virtual:button", source: "virtual", sourceId: "button", type: "switch", presentationType: "switch", name: "Arrived", reachable: true, state: { on: false }, capabilities: ["toggle", "turnOn", "turnOff"], homekitEnabled: true, hidden: false, credentialMode: "none", passwordConfigured: false, lastSeen: "2026-08-15T00:00:00.000Z", lastEvent: "2026-08-15T00:00:00.000Z", adapterData: { virtualType: "button", momentaryResetMs: 500 } };
    const createButton = vi.fn(async () => created as never);
    const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, { createButton });
    const response = await authenticatedInject(server, { method: "POST", url: "/api/adapters/virtual/devices", payload: { name: "Arrived", type: "button" } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ source: "virtual", type: "switch", presentationType: "switch", name: "Arrived", adapterData: { virtualType: "button", momentaryResetMs: 500 } });
    expect(createButton).toHaveBeenCalledWith("Arrived", undefined, undefined);
  });

  it("converts an existing virtual switch to a momentary button without replacing its id", async () => {
    const current = { id: "virtual:test", source: "virtual", sourceId: "test", type: "switch", presentationType: "switch", name: "Arrived", roomId: undefined, room: undefined, reachable: true, state: { on: false }, capabilities: ["toggle", "turnOn", "turnOff"], homekitEnabled: true, hidden: false, credentialMode: "none", passwordConfigured: false, lastSeen: "2026-08-15T00:00:00.000Z", lastEvent: "2026-08-15T00:00:00.000Z", adapterData: { virtualType: "switch" } };
    const updatedKind = { ...current, model: "SALTA Virtual Button", profile: "button", adapterData: { virtualType: "button", momentaryResetMs: 500 } };
    const updateKind = vi.fn(async () => updatedKind as never);
    const patch = vi.fn(async (_id: string, patchValue: Record<string, unknown>) => ({ ...updatedKind, ...patchValue } as never));
    const server = createServer(vi.fn(), vi.fn(), { get: () => current as never, patch }, {}, {}, { updateKind });
    const response = await authenticatedInject(server, { method: "PATCH", url: "/api/devices/virtual%3Atest/config", payload: { name: "Arrived", virtualType: "button", presentationType: "switch" } });
    expect(response.statusCode).toBe(200);
    expect(updateKind).toHaveBeenCalledWith("virtual:test", "button");
    expect(patch).toHaveBeenCalled();
  });

  it("routes API commands to the virtual adapter", async () => {
    const current = { id: "virtual:test", source: "virtual", capabilities: ["toggle", "turnOn", "turnOff"] };
    const command = vi.fn(async () => ({ ...current, state: { on: true } } as never));
    const server = createServer(vi.fn(), vi.fn(), { get: () => current as never }, {}, {}, { command });
    const response = await authenticatedInject(server, { method: "POST", url: "/api/devices/virtual%3Atest/command", payload: { capability: "turnOn" } });
    expect(response.statusCode).toBe(200);
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ deviceId: "virtual:test", capability: "turnOn", source: "api" }));
  });

  it("removes virtual devices through the common device endpoint", async () => {
    const current = { id: "virtual:test", source: "virtual" };
    const remove = vi.fn(async () => undefined);
    const server = createServer(vi.fn(), vi.fn(), { get: () => current as never }, {}, {}, { remove });
    const response = await authenticatedInject(server, { method: "DELETE", url: "/api/devices/virtual%3Atest" });
    expect(response.statusCode).toBe(204);
    expect(remove).toHaveBeenCalledWith("virtual:test");
  });
});


describe("disaster recovery backup API", () => {
  it("exports a password encrypted full recovery backup", async () => {
    vi.mocked(createDisasterRecoveryBackup).mockResolvedValueOnce({
      format: "salta-disaster-recovery-backup", formatVersion: 1, saltaVersion: "0.8.80", createdAt: "2026-08-14T07:00:00.000Z",
      summary: { rooms: 7, devices: 49, automations: 4, presenceTargets: 2, homeKitFiles: 2 },
      encryption: { algorithm: "aes-256-gcm", kdf: "scrypt", salt: "1234567890123456", iv: "123456789012", tag: "1234567890123456" },
      ciphertext: "encrypted-payload"
    });
    const server = createServer(vi.fn());
    const response = await authenticatedInject(server, { method: "POST", url: "/api/settings/disaster-recovery-backup", payload: { password: "correct horse battery staple" } });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["content-disposition"]).toContain("SALTA-full-backup-");
    expect(response.json().format).toBe("salta-disaster-recovery-backup");
    expect(createDisasterRecoveryBackup).toHaveBeenCalledWith("0.8.80", "correct horse battery staple");
  });

  it("imports a full recovery backup and schedules a restart", async () => {
    vi.mocked(importDisasterRecoveryBackup).mockResolvedValueOnce({ importedAt: "2026-08-14T07:01:00.000Z", sourceVersion: "0.8.42", rooms: 7, devices: 49, automations: 4, presenceTargets: 2, containsEncryptedSecrets: true, homeKitFiles: 2, runtimeSettingsRestored: true, deploymentWarnings: [] });
    const restart = vi.fn();
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    try {
      const server = createServer(vi.fn(), vi.fn(), {}, {}, {}, {}, {}, undefined, restart);
      const backup = { format: "salta-disaster-recovery-backup" };
      const response = await authenticatedInject(server, { method: "POST", url: "/api/settings/disaster-recovery-backup/import", payload: { password: "correct horse battery staple", backup } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: "ok", rooms: 7, devices: 49, homeKitFiles: 2, restartScheduled: true });
      expect(importDisasterRecoveryBackup).toHaveBeenCalledWith(backup, "correct horse battery staple");
      const scheduledRestart = timeoutSpy.mock.calls.findIndex(([, delay]) => delay === 750);
      expect(scheduledRestart).toBeGreaterThanOrEqual(0);
      const timer = timeoutSpy.mock.results[scheduledRestart]?.value as ReturnType<typeof setTimeout> | undefined;
      if (timer) clearTimeout(timer);
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});
