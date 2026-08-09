import { describe, expect, it, vi } from "vitest";
import { DeviceCommandRouter } from "./device-command-router.js";

describe("DeviceCommandRouter", () => {
  it("routes commands by persisted device source", async () => {
    const device = { id: "virtual:test", source: "virtual" };
    const command = vi.fn(async () => ({ ...device, state: { on: true } }));
    const router = new DeviceCommandRouter({ get: () => device } as never, { virtual: { command } } as never);
    await router.command({ deviceId: device.id, capability: "turnOn", source: "homekit" });
    expect(command).toHaveBeenCalledWith({ deviceId: device.id, capability: "turnOn", source: "homekit" });
  });
});
