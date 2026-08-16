import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { Device } from "./types.js";

vi.mock("./db.js", () => ({
  getVacationModeSettings: vi.fn(async () => ({ enabled: false })),
  updateVacationModeSettings: vi.fn(async (enabled: boolean) => ({ enabled })),
  getPushoverSettings: vi.fn(async () => ({ enabled: false, userKeyConfigured: true, apiTokenConfigured: true, encryptionStatus: "ok", batteryThreshold: 20 })),
  getPushoverConnection: vi.fn(async () => ({ enabled: false, userKey: "user", apiToken: "token", batteryThreshold: 20 })),
  writeSystemLog: vi.fn(async () => undefined)
}));

import { getPushoverConnection, getVacationModeSettings } from "./db.js";
import { VACATION_MODE_AUTOMATION_DEVICE_ID, VacationModeManager } from "./vacation-mode.js";

function contact(open = false): Device {
  return {
    id: "window", source: "openccu", sourceId: "window", type: "contactSensor", name: "Fenster Wohnzimmer", room: "Wohnzimmer", reachable: true,
    state: { open }, capabilities: [], homekitEnabled: true, hidden: false, credentialMode: "none", passwordConfigured: false,
    lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString()
  };
}

class Registry extends EventEmitter {
  devices = new Map<string, Device>();
  all(): Device[] { return [...this.devices.values()]; }
  get(id: string): Device | undefined { return this.devices.get(id); }
  async set(device: Device): Promise<void> { this.devices.set(device.id, device); this.emit("device", device); }
  update(device: Device): void { this.devices.set(device.id, device); this.emit("device", device); }
}

describe("vacation mode security monitor", () => {
  it("persists a hidden boolean system device for automation conditions", async () => {
    vi.mocked(getVacationModeSettings).mockResolvedValue({ enabled: true });
    const registry = new Registry();
    const manager = new VacationModeManager(registry as never, "Europe/Berlin", vi.fn());
    await manager.initialize();
    expect(registry.get(VACATION_MODE_AUTOMATION_DEVICE_ID)).toEqual(expect.objectContaining({
      source: "system", hidden: true, homekitEnabled: false, state: expect.objectContaining({ vacationActive: true }), adapterData: expect.objectContaining({ systemKind: "vacationMode" })
    }));
  });

  it("sends one Pushover alert only for a closed-to-open transition while vacation mode is active", async () => {
    vi.mocked(getVacationModeSettings).mockResolvedValue({ enabled: true });
    vi.mocked(getPushoverConnection).mockResolvedValue({ enabled: false, userKey: "user", apiToken: "token", batteryThreshold: 20 });
    const registry = new Registry();
    registry.devices.set("window", contact(false));
    const sender = vi.fn(async () => undefined);
    const manager = new VacationModeManager(registry as never, "Europe/Berlin", sender);
    await manager.initialize();
    manager.start();

    registry.update(contact(true));
    await vi.waitFor(() => expect(sender).toHaveBeenCalledTimes(1));
    registry.update(contact(true));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0]?.[0].title).toContain("Urlaubsmodus");
    expect(sender.mock.calls[0]?.[0].message).toContain("Fenster Wohnzimmer");
    expect(sender.mock.calls[0]?.[0].message).toContain("Wohnzimmer");
    manager.stop();
  });

  it("does not alert while vacation mode is disabled", async () => {
    vi.mocked(getVacationModeSettings).mockResolvedValue({ enabled: false });
    const registry = new Registry();
    registry.devices.set("window", contact(false));
    const sender = vi.fn(async () => undefined);
    const manager = new VacationModeManager(registry as never, "Europe/Berlin", sender);
    await manager.initialize();
    manager.start();
    registry.update(contact(true));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sender).not.toHaveBeenCalled();
    manager.stop();
  });
});
