import { describe, expect, it, vi } from "vitest";
import type { Device } from "./types.js";

vi.mock("./db.js", () => ({
  getPushoverSettings: vi.fn(async () => ({ enabled: true, userKeyConfigured: true, apiTokenConfigured: true, encryptionStatus: "ok", batteryThreshold: 20, debugEnabled: false })),
  getPushoverConnection: vi.fn(async () => ({ enabled: true, userKey: "user", apiToken: "token", batteryThreshold: 20, debugEnabled: false })),
  getNotificationLastSent: vi.fn(async () => undefined),
  setNotificationLastSent: vi.fn(async () => undefined),
  writeSystemLog: vi.fn(async () => undefined)
}));

import { getNotificationLastSent, setNotificationLastSent } from "./db.js";
import { BatteryMonitor, batteryWarnings } from "./battery-monitor.js";

function device(id: string, state: Device["state"]): Device {
  return { id, source: "phoscon", sourceId: id, type: "contactSensor", name: id, reachable: true, state, capabilities: [], homekitEnabled: false, hidden: false, credentialMode: "none", passwordConfigured: false, lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString() };
}

describe("battery warnings", () => {
  it("detects percentage thresholds and explicit low-battery states", () => {
    const warnings = batteryWarnings([device("low", { battery: 15 }), device("ok", { battery: 80 }), device("flag", { lowBattery: true })], 20);
    expect(warnings.map(item => item.deviceId)).toEqual(["low", "flag"]);
  });

  it("sends one aggregated warning and persists its timestamp", async () => {
    const sender = vi.fn(async () => undefined);
    const registry = { all: () => [device("low", { battery: 10 }), device("flag", { lowBattery: true })], on: vi.fn(), off: vi.fn() };
    const monitor = new BatteryMonitor(registry as never, sender);
    await monitor.evaluate(new Date("2026-08-13T08:00:00.000Z"));
    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0]?.[0].title).toBe("SALTA Batteriewarnung");
    expect(sender.mock.calls[0]?.[0].message).toContain("2 Geräte");
    expect(setNotificationLastSent).toHaveBeenCalledTimes(1);
  });

  it("does not send another battery warning before seven days have passed", async () => {
    vi.mocked(getNotificationLastSent).mockResolvedValueOnce("2026-08-10T08:00:00.000Z").mockResolvedValueOnce("2026-08-10T08:00:00.000Z");
    const sender = vi.fn(async () => undefined);
    const registry = { all: () => [device("low", { battery: 10 })], on: vi.fn(), off: vi.fn() };
    const monitor = new BatteryMonitor(registry as never, sender);
    await monitor.evaluate(new Date("2026-08-13T08:00:00.000Z"));
    expect(sender).not.toHaveBeenCalled();
  });
});
