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
    config: { bridgeid: "00212EFFFF012345", name: "Phoscon-GW", websocketport: 8088 },
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

describe("Phoscon button-event race recovery", () => {
  let payload: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    payload = buttonPayload("2026-08-18T06:40:00.000");
    vi.stubGlobal("fetch", vi.fn(async () => response(payload)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emits a button event when normal reconcile discovers a timestamp missed by realtime polling", async () => {
    const registry = new DeviceRegistry();
    const adapter = new PhosconAdapter(registry);
    const events: DeviceEvent[] = [];
    registry.on("deviceEvent", event => events.push(event as DeviceEvent));

    await adapter.reconcile();
    expect(events).toHaveLength(0);

    payload = buttonPayload("2026-08-18T06:40:15.000");
    await adapter.reconcile();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ source: "phoscon", key: "buttonEvent", value: 1002 });
    expect(registry.all()[0]?.adapterData?.buttonEventTransport).toBe("reconcile");
  });

  it("does not emit the same deCONZ event twice when poll wins before reconcile", async () => {
    const registry = new DeviceRegistry();
    const adapter = new PhosconAdapter(registry);
    const events: DeviceEvent[] = [];
    registry.on("deviceEvent", event => events.push(event as DeviceEvent));
    await adapter.reconcile();

    const apply = (adapter as unknown as ButtonResourceApplier).applyButtonResource.bind(adapter);
    const lastUpdated = "2026-08-18T06:40:15.000";
    await apply("30", { buttonevent: 1002, lastupdated: lastUpdated }, { reachable: true }, "Aqara Mini Switch", "poll");
    payload = buttonPayload(lastUpdated);
    await adapter.reconcile();

    expect(events).toHaveLength(1);
    expect(registry.all()[0]?.adapterData?.buttonEventTransport).toBe("poll");
  });

  it("suppresses a delayed websocket duplicate after reconcile already recovered the event", async () => {
    const registry = new DeviceRegistry();
    const adapter = new PhosconAdapter(registry);
    const events: DeviceEvent[] = [];
    registry.on("deviceEvent", event => events.push(event as DeviceEvent));
    await adapter.reconcile();

    const apply = (adapter as unknown as ButtonResourceApplier).applyButtonResource.bind(adapter);
    const lastUpdated = "2026-08-18T06:40:15.000";
    payload = buttonPayload(lastUpdated);
    await adapter.reconcile();
    await apply("30", { buttonevent: 1002, lastupdated: lastUpdated }, { reachable: true }, "Aqara Mini Switch", "websocket");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ source: "phoscon", key: "buttonEvent", value: 1002 });
  });

  it("suppresses a delayed websocket duplicate after reconcile already recovered the event", async () => {
    const registry = new DeviceRegistry();
    const adapter = new PhosconAdapter(registry);
    const events: DeviceEvent[] = [];
    registry.on("deviceEvent", event => events.push(event as DeviceEvent));
    await adapter.reconcile();

    const apply = (adapter as unknown as ButtonResourceApplier).applyButtonResource.bind(adapter);
    const lastUpdated = "2026-08-18T06:40:15.000";
    payload = buttonPayload(lastUpdated);
    await adapter.reconcile();
    await apply("30", { buttonevent: 1002, lastupdated: lastUpdated }, { reachable: true }, "Aqara Mini Switch", "websocket");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ source: "phoscon", key: "buttonEvent", value: 1002 });
  });

  it("does not emit twice when reconcile and fallback poll observe the same event concurrently", async () => {
    const registry = new DeviceRegistry();
    const adapter = new PhosconAdapter(registry);
    const events: DeviceEvent[] = [];
    registry.on("deviceEvent", event => events.push(event as DeviceEvent));
    await adapter.reconcile();

    const apply = (adapter as unknown as ButtonResourceApplier).applyButtonResource.bind(adapter);
    const lastUpdated = "2026-08-18T06:40:15.000";
    payload = buttonPayload(lastUpdated);
    await Promise.all([
      adapter.reconcile(),
      apply("30", { buttonevent: 1002, lastupdated: lastUpdated }, { reachable: true }, "Aqara Mini Switch", "poll")
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ source: "phoscon", key: "buttonEvent", value: 1002 });
  });
});
