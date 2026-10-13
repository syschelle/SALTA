import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeviceEvent } from "./types.js";
import type { OpenCcuCatalogEntry } from "./openccu-core.js";

const dbMocks = vi.hoisted(() => ({
  clearOpenCcuSettings: vi.fn(async () => undefined),
  getClimateModeSettings: vi.fn(async () => ({ mode: "winter", winterMode: "manual" })),
  getOpenCcuConnection: vi.fn(async () => ({ baseUrl: "", username: "", password: "" })),
  updateOpenCcuSettings: vi.fn(async () => undefined),
  writeSystemLog: vi.fn(async () => undefined),
  deleteDevice: vi.fn(async () => undefined),
  setDeviceCredentials: vi.fn(async () => undefined),
  updateDeviceHomeKitSettings: vi.fn(async () => undefined),
  upsertDevice: vi.fn(async () => undefined)
}));

vi.mock("./db.js", () => dbMocks);

import { OpenCcuAdapter } from "./openccu-adapter.js";
import { openCcuDeviceFromChannel } from "./openccu-core.js";
import { DeviceRegistry } from "./registry.js";

describe("OpenCCU realtime event application", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the KEY device and emits exactly one SALTA button event for PRESS_SHORT", async () => {
    const entry: OpenCcuCatalogEntry = {
      interfaceName: "BidCos-RF",
      channelAddress: "REQ0862479:2",
      channelType: "KEY",
      deviceAddress: "REQ0862479",
      deviceName: "Wandtaster Wohnzimmer",
      channelName: "Wandtaster Wohnzimmer:2",
      model: "HM-PB-6-WM55",
      firmwareVersion: "1.2",
      channelCount: 7
    };
    const device = openCcuDeviceFromChannel({ ...entry, baseUrl: "http://openccu.local", values: {} });
    expect(device).toBeDefined();
    const registry = new DeviceRegistry();
    registry.hydrate(device!);
    const adapter = new OpenCcuAdapter(registry);
    const internal = adapter as unknown as {
      catalog: OpenCcuCatalogEntry[];
      applyRealtimeEvent(event: { channelAddress: string; parameter: string; value: string | number | boolean }): Promise<void>;
    };
    internal.catalog = [entry];
    const events: DeviceEvent[] = [];
    registry.on("deviceEvent", event => events.push(event as DeviceEvent));

    await internal.applyRealtimeEvent({ channelAddress: "REQ0862479:2", parameter: "PRESS_SHORT", value: true });

    expect(registry.get(device!.id)).toMatchObject({
      type: "button",
      reachable: true,
      state: { buttonEvent: 1002 },
      adapterData: { buttonEventProtocol: "openccu-xmlrpc", buttonEventParameter: "PRESS_SHORT" }
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ deviceId: device!.id, source: "openccu", key: "buttonEvent", value: 1002 });

    await internal.applyRealtimeEvent({ channelAddress: "REQ0862479:2", parameter: "PRESS_CONT", value: true });
    await internal.applyRealtimeEvent({ channelAddress: "REQ0862479:2", parameter: "INSTALL_TEST", value: true });
    expect(events).toHaveLength(1);
  });

  it("updates a classic HM-Sec-SCo contact immediately from STATE callbacks", async () => {
    const entry: OpenCcuCatalogEntry = {
      interfaceName: "BidCos-RF",
      channelAddress: "NEQ1157537:1",
      channelType: "SHUTTER_CONTACT",
      deviceAddress: "NEQ1157537",
      deviceName: "Eingangstür",
      channelName: "HM-Sec-SCo NEQ1157537:1",
      model: "HM-Sec-SCo",
      firmwareVersion: "1.0",
      channelCount: 2
    };
    const device = openCcuDeviceFromChannel({
      ...entry,
      baseUrl: "http://openccu.local",
      values: { STATE: false, LOWBAT: false }
    });
    expect(device).toBeDefined();
    expect(device).toMatchObject({ type: "contactSensor", state: { open: false } });

    const registry = new DeviceRegistry();
    registry.hydrate(device!);
    const adapter = new OpenCcuAdapter(registry);
    const internal = adapter as unknown as {
      applyRealtimeEvent(event: { channelAddress: string; parameter: string; value: string | number | boolean }): Promise<void>;
    };

    // Deliberately leave the adapter catalogue empty. Production callbacks
    // must bind through the live registry metadata for the channel address.
    await internal.applyRealtimeEvent({ channelAddress: "NEQ1157537:1", parameter: "STATE", value: true });
    const opened = registry.get(device!.id);
    expect(opened).toMatchObject({
      type: "contactSensor",
      reachable: true,
      state: { open: true },
      adapterData: {
        stateEventOrigin: "openccu-xmlrpc",
        stateEventTransport: "xmlrpc",
        stateEventParameter: "STATE",
        stateEventValue: true
      }
    });
    expect(opened?.lastEvent).toBeTruthy();

    await internal.applyRealtimeEvent({ channelAddress: "NEQ1157537:1", parameter: "LOWBAT", value: true });
    expect(registry.get(device!.id)?.state.open).toBe(true);

    await internal.applyRealtimeEvent({ channelAddress: "NEQ1157537:1", parameter: "STATE", value: false });
    expect(registry.get(device!.id)).toMatchObject({
      state: { open: false },
      adapterData: {
        stateEventOrigin: "openccu-xmlrpc",
        stateEventParameter: "STATE",
        stateEventValue: false
      }
    });
  });
});
