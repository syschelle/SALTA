import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  clearPhosconSettings: vi.fn(async (): Promise<void> => undefined),
  deleteDevice: vi.fn(async (): Promise<boolean> => true),
  getPhosconConnection: vi.fn(async () => ({ baseUrl: "http://192.168.178.20:8080", apiKey: "test-key" })),
  setDeviceCredentials: vi.fn(async (): Promise<void> => undefined),
  updateDeviceHomeKitSettings: vi.fn(async (): Promise<void> => undefined),
  updatePhosconSettings: vi.fn(async (): Promise<void> => undefined),
  upsertDevice: vi.fn(async (): Promise<void> => undefined),
  writeSystemLog: vi.fn(async (): Promise<void> => undefined)
}));

vi.mock("./db.js", () => dbMocks);

import { PhosconAdapter } from "./phoscon-adapter.js";
import { DeviceRegistry } from "./registry.js";
import type { DeviceEvent } from "./types.js";

function buttonPayload(lastUpdated: string, buttonEvent = 1002): unknown {
  return {
    config: { bridgeid: "00212EFFFF012345", name: "deCONZ-GW", websocketport: 8088 },
    lights: {},
    sensors: {
      "30": {
        name: "Aqara Mini Switch",
        type: "ZHASwitch",
        modelid: "lumi.remote.b1acn01",
        uniqueid: "00:15:8d:00:01:02:03:04-01-0012",
        state: { buttonevent: buttonEvent, lastupdated: lastUpdated },
        config: { battery: 91, reachable: true }
      }
    }
  };
}

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

type ButtonResourceApplier = {
  applyButtonResource(
    resourceId: string,
    rawState: Record<string, unknown>,
    rawConfig: Record<string, unknown>,
    name: string | undefined,
    transport: "websocket" | "poll"
  ): Promise<void>;
};

describe("deCONZ button recovery baseline", () => {
  let payload: unknown;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    payload = buttonPayload("2026-08-22T16:40:00.000");
    fetchMock = vi.fn(async () => response(payload));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("baselines button revisions after a REST connectivity failure without replaying an automation event", async () => {
    const registry = new DeviceRegistry();
    const adapter = new PhosconAdapter(registry);
    const events: DeviceEvent[] = [];
    registry.on("deviceEvent", event => events.push(event as DeviceEvent));

    await adapter.reconcile();
    expect(events).toHaveLength(0);

    payload = buttonPayload("2026-08-22T16:41:00.000");
    await adapter.reconcile();
    expect(events).toHaveLength(1);

    fetchMock.mockRejectedValueOnce(new Error("network unavailable"));
    await expect(adapter.reconcile()).rejects.toThrow("network unavailable");

    payload = buttonPayload("2026-08-22T16:50:00.000");
    await adapter.reconcile();
    expect(events).toHaveLength(1);
    expect(registry.all()[0]?.adapterData?.buttonEventLastUpdated).toBe("2026-08-22T16:50:00.000");
    expect(dbMocks.writeSystemLog).toHaveBeenCalledWith(
      "info",
      "phoscon",
      "DECONZ_RECOVERY_BASELINE",
      "deCONZ button state baseline accepted after connectivity recovery",
      expect.objectContaining({ reason: "rest-sync-failed", buttonDevices: 1 })
    );

    payload = buttonPayload("2026-08-22T16:51:00.000");
    await adapter.reconcile();
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ source: "phoscon", key: "buttonEvent", value: 1002 });
  });

  it("requires a genuinely new deCONZ lastupdated revision for websocket button delivery", async () => {
    const registry = new DeviceRegistry();
    const adapter = new PhosconAdapter(registry);
    const events: DeviceEvent[] = [];
    registry.on("deviceEvent", event => events.push(event as DeviceEvent));
    await adapter.reconcile();

    const apply = (adapter as unknown as ButtonResourceApplier).applyButtonResource.bind(adapter);
    const revision = "2026-08-22T16:41:00.000";
    await apply("30", { buttonevent: 1002, lastupdated: revision }, { reachable: true }, "Aqara Mini Switch", "websocket");
    expect(events).toHaveLength(1);

    await apply("30", { buttonevent: 1002, lastupdated: revision }, { reachable: true }, "Aqara Mini Switch", "websocket");
    await apply("30", { buttonevent: 1002 }, { reachable: true }, "Aqara Mini Switch", "websocket");
    expect(events).toHaveLength(1);
  });
});
