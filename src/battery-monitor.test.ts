import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "./types.js";

vi.mock("./db.js", () => ({
  getPushoverSettings: vi.fn(async () => ({ enabled: true, userKeyConfigured: true, apiTokenConfigured: true, encryptionStatus: "ok", batteryThreshold: 20 })),
  getPushoverConnection: vi.fn(async () => ({ enabled: true, userKey: "user", apiToken: "token", batteryThreshold: 20 })),
  getNotificationLastSent: vi.fn(async () => undefined),
  setNotificationLastSent: vi.fn(async () => undefined),
  writeSystemLog: vi.fn(async () => undefined)
}));

import { getNotificationLastSent, setNotificationLastSent } from "./db.js";
import { BatteryMonitor, batteryWarnings, openCcuWarnings } from "./battery-monitor.js";

function device(id: string, state: Device["state"]): Device {
  return { id, source: "phoscon", sourceId: id, type: "contactSensor", name: id, reachable: true, state, capabilities: [], homekitEnabled: false, hidden: false, credentialMode: "none", passwordConfigured: false, lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString() };
}

function openCcuDevice(id: string, state: Device["state"], reachable = true): Device {
  const physical = id.split(":")[2]?.split("_")[0] ?? id;
  return {
    ...device(id, state),
    source: "openccu",
    sourceId: id,
    type: "thermostat",
    name: `Thermostat ${physical}`,
    macAddress: physical,
    reachable
  };
}

describe("battery warnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNotificationLastSent).mockResolvedValue(undefined);
  });

  it("detects percentage thresholds and explicit low-battery states", () => {
    const warnings = batteryWarnings([device("low", { battery: 15 }), device("ok", { battery: 80 }), device("flag", { lowBattery: true })], 20);
    expect(warnings.map(item => item.deviceId)).toEqual(["low", "flag"]);
  });

  it("deduplicates multiple OpenCCU channels of the same low-battery HomeMatic device", () => {
    const first = openCcuDevice("openccu:BidCos-RF:MEQ123:4", { lowBattery: true });
    const second = openCcuDevice("openccu:BidCos-RF:MEQ123:2", { lowBattery: true });
    const warnings = openCcuWarnings([first, second], 20);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.lowBattery).toBe(true);
  });

  it("includes an unreachable OpenCCU device even when no LOWBAT value is available", () => {
    const warnings = openCcuWarnings([openCcuDevice("openccu:BidCos-RF:MEQ456:4", {}, false)], 20);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ unreachable: true, lowBattery: false });
  });

  it("keeps a reachable OpenCCU device without a battery warning out of the daily warning", () => {
    expect(openCcuWarnings([openCcuDevice("openccu:BidCos-RF:MEQ789:4", {}, true)], 20)).toEqual([]);
  });

  it("sends one aggregated general warning and persists its timestamp", async () => {
    const sender = vi.fn(async () => undefined);
    const registry = { all: () => [device("low", { battery: 10 }), device("flag", { lowBattery: true })], on: vi.fn(), off: vi.fn() };
    const monitor = new BatteryMonitor(registry as never, sender);
    await monitor.evaluate(new Date("2026-08-13T08:00:00.000Z"));
    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0]?.[0].title).toBe("SALTA Batteriewarnung");
    expect(sender.mock.calls[0]?.[0].message).toContain("2 Geräte");
    expect(setNotificationLastSent).toHaveBeenCalledWith("battery-warning", "2026-08-13T08:00:00.000Z", expect.any(Object));
  });

  it("does not send another general battery warning before seven days have passed", async () => {
    vi.mocked(getNotificationLastSent).mockImplementation(async key => key === "battery-warning" ? "2026-08-10T08:00:00.000Z" : undefined);
    const sender = vi.fn(async () => undefined);
    const registry = { all: () => [device("low", { battery: 10 })], on: vi.fn(), off: vi.fn() };
    const monitor = new BatteryMonitor(registry as never, sender);
    await monitor.evaluate(new Date("2026-08-13T08:00:00.000Z"));
    expect(sender).not.toHaveBeenCalled();
  });

  it("sends a dedicated daily OpenCCU warning for LOWBAT and unreachable devices", async () => {
    const sender = vi.fn(async () => undefined);
    const registry = {
      all: () => [
        openCcuDevice("openccu:BidCos-RF:MEQ100:4", { lowBattery: true }, true),
        openCcuDevice("openccu:BidCos-RF:MEQ200:4", {}, false)
      ],
      on: vi.fn(),
      off: vi.fn()
    };
    const monitor = new BatteryMonitor(registry as never, sender);
    await monitor.evaluate(new Date("2026-11-26T08:00:00.000Z"));

    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0]?.[0].title).toBe("SALTA OpenCCU/HomeMatic Warnung");
    expect(sender.mock.calls[0]?.[0].message).toContain("Batteriewarnung aktiv");
    expect(sender.mock.calls[0]?.[0].message).toContain("nicht erreichbar");
    expect(setNotificationLastSent).toHaveBeenCalledWith("openccu-device-warning", "2026-11-26T08:00:00.000Z", expect.any(Object));
  });

  it("does not repeat the OpenCCU warning before 24 hours have passed", async () => {
    vi.mocked(getNotificationLastSent).mockImplementation(async key => key === "openccu-device-warning" ? "2026-11-26T08:00:00.000Z" : undefined);
    const sender = vi.fn(async () => undefined);
    const registry = { all: () => [openCcuDevice("openccu:BidCos-RF:MEQ200:4", {}, false)], on: vi.fn(), off: vi.fn() };
    const monitor = new BatteryMonitor(registry as never, sender);
    await monitor.evaluate(new Date("2026-11-27T07:59:59.000Z"));
    expect(sender).not.toHaveBeenCalled();
  });

  it("repeats the OpenCCU warning after 24 hours while the issue persists", async () => {
    vi.mocked(getNotificationLastSent).mockImplementation(async key => key === "openccu-device-warning" ? "2026-11-26T08:00:00.000Z" : undefined);
    const sender = vi.fn(async () => undefined);
    const registry = { all: () => [openCcuDevice("openccu:BidCos-RF:MEQ200:4", {}, false)], on: vi.fn(), off: vi.fn() };
    const monitor = new BatteryMonitor(registry as never, sender);
    await monitor.evaluate(new Date("2026-11-27T08:00:00.000Z"));
    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0]?.[0].message).toContain("nicht erreichbar");
  });

  it("does not send the weekly generic warning for OpenCCU devices", async () => {
    const sender = vi.fn(async () => undefined);
    const registry = { all: () => [openCcuDevice("openccu:BidCos-RF:MEQ300:4", { lowBattery: true }, true)], on: vi.fn(), off: vi.fn() };
    const monitor = new BatteryMonitor(registry as never, sender);
    await monitor.evaluate(new Date("2026-11-26T08:00:00.000Z"));
    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0]?.[0].title).toBe("SALTA OpenCCU/HomeMatic Warnung");
  });
});
