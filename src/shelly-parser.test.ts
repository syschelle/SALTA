import { describe, expect, it } from "vitest";
import { detectGen1Shelly, detectRpcShelly } from "./shelly-parser.js";

describe("detectRpcShelly", () => {
  it("detects a Shelly plug as an outlet and exposes live measurements", () => {
    const result = detectRpcShelly(
      { app: "PlusPlugS", model: "SNPL-00112EU", gen: 2 },
      {
        "switch:0": {
          id: 0,
          output: true,
          apower: 42.7,
          voltage: 230.4,
          current: 0.19,
          aenergy: { total: 1234.5 },
          temperature: { tC: 38.2 }
        },
        "input:0": { id: 0, state: false }
      }
    );

    expect(result.type).toBe("outlet");
    expect(result.componentKind).toBe("switch");
    expect(result.state).toEqual({
      on: true,
      power: 42.7,
      energy: 1234.5,
      voltage: 230.4,
      current: 0.19,
      temperature: 38.2
    });
    expect(result.powerMetering).toBe(true);
    expect(result.inputSupport).toBe(true);
  });

  it("prioritizes a cover component over switch components", () => {
    const result = detectRpcShelly(
      { app: "Plus2PM", profile: "cover", gen: 2 },
      {
        "switch:0": { id: 0, output: false },
        "switch:1": { id: 1, output: false },
        "cover:0": { id: 0, state: "opening", current_pos: 37, target_pos: 100, apower: 88.1 }
      }
    );

    expect(result.type).toBe("windowCovering");
    expect(result.componentKind).toBe("cover");
    expect(result.state).toEqual({
      currentPosition: 37,
      targetPosition: 100,
      positionState: "opening",
      power: 88.1
    });
  });

  it("supports standalone PM1 energy meters", () => {
    const result = detectRpcShelly(
      { app: "PMMiniG3", gen: 3 },
      {
        "pm1:0": {
          id: 0,
          apower: 321.4,
          voltage: 229.8,
          current: 1.4,
          aenergy: { total: 9876.5 }
        }
      }
    );

    expect(result.type).toBe("energyMeter");
    expect(result.state).toEqual({ totalPower: 321.4, voltage: 229.8, current: 1.4, energy: 9876.5 });
    expect(result.capabilities).toEqual([]);
  });

  it("aggregates multi-channel energy meter power", () => {
    const result = detectRpcShelly(
      { app: "ProEM", gen: 2 },
      {
        "em1:0": { id: 0, act_power: 100, voltage: 230, current: 0.5, aenergy: { total: 1000 } },
        "em1:1": { id: 1, act_power: 200, voltage: 231, current: 0.9, aenergy: { total: 2000 } },
        "switch:0": { id: 0, output: false }
      }
    );

    expect(result.type).toBe("energyMeter");
    expect(result.state.totalPower).toBe(300);
    expect(result.state.energy).toBe(3000);
    expect(result.channelCount).toBe(2);
  });

  it("prefers a dedicated PM1 component over a stale zero on the switch", () => {
    const result = detectRpcShelly(
      { app: "1PMG4", model: "S4SW-001P16EU", gen: 4 },
      {
        "switch:0": { id: 0, output: true, apower: 0 },
        "pm1:0": { id: 0, apower: 84.6, voltage: 230.8, current: 0.37, aenergy: { total: 144.2 } }
      }
    );

    expect(result.state).toMatchObject({ on: true, power: 84.6, voltage: 230.8, current: 0.37, energy: 144.2 });
  });

  it("uses the only dedicated meter when its component id differs", () => {
    const result = detectRpcShelly(
      { app: "RelayWithExternalPM", gen: 4 },
      {
        "switch:0": { id: 0, output: true },
        "pm1:100": { id: 100, apower: 51.3, voltage: 229.9, current: 0.23 }
      }
    );

    expect(result.state).toMatchObject({ on: true, power: 51.3, voltage: 229.9, current: 0.23 });
  });

  it("does not invent unavailable measurements", () => {
    const result = detectRpcShelly({ app: "Plus1" }, { "switch:0": { id: 0, output: false } });
    expect(result.state).toEqual({ on: false });
  });
});

describe("detectGen1Shelly", () => {
  it("detects Shelly Plug S as an outlet and converts Watt-minutes to Wh", () => {
    const result = detectGen1Shelly(
      { device: { type: "SHPLG-S", hostname: "shellyplug-s-123456" } },
      {
        relays: [{ ison: true }],
        meters: [{ power: 25.5, total: 600 }],
        inputs: [{ input: 0 }]
      }
    );

    expect(result.type).toBe("outlet");
    expect(result.state).toEqual({ on: true, power: 25.5, energy: 10 });
    expect(result.inputSupport).toBe(true);
  });


  it("does not expose the Shelly 1 nominal load as measured power", () => {
    const result = detectGen1Shelly(
      { device: { type: "SHSW-1", hostname: "shelly1-123456" } },
      {
        relays: [{ ison: true }],
        meters: [{ power: 0, is_valid: true }],
        inputs: [{ input: 1 }]
      }
    );

    expect(result.type).toBe("switch");
    expect(result.state).toEqual({ on: true });
    expect(result.powerMetering).toBe(false);
  });

  it("keeps real Shelly 1PM measurements", () => {
    const result = detectGen1Shelly(
      { device: { type: "SHSW-PM", hostname: "shelly1pm-123456" } },
      {
        relays: [{ ison: true }],
        meters: [{ power: 73.4, total: 1200, is_valid: true }],
        inputs: [{ input: 1 }]
      }
    );

    expect(result.state).toEqual({ on: true, power: 73.4, energy: 20 });
    expect(result.powerMetering).toBe(true);
  });

  it("detects roller mode before relay mode", () => {
    const result = detectGen1Shelly(
      { mode: "roller", device: { type: "SHSW-25", hostname: "shellyswitch25-123456" } },
      {
        relays: [{ ison: false }, { ison: false }],
        rollers: [{ state: "stop", current_pos: 64, power: 0 }],
        meters: [{ total: 120 }]
      }
    );

    expect(result.type).toBe("windowCovering");
    expect(result.state).toEqual({
      currentPosition: 64,
      targetPosition: 64,
      positionState: "stop",
      power: 0,
      energy: 2
    });
  });
});

it("detects both switch channels on a Shelly Plus 2PM", () => {
  const result = detectRpcShelly(
    { id: "shellyplus2pm-test", app: "Plus2PM", model: "SNSW-102P16EU", gen: 2, profile: "switch" },
    {
      "switch:0": { id: 0, output: true, apower: 12.4, voltage: 230.1, current: 0.06 },
      "switch:1": { id: 1, output: false, apower: 0, voltage: 230.2, current: 0 },
      "input:0": { id: 0, state: true },
      "input:1": { id: 1, state: false }
    }
  );

  expect(result.type).toBe("switch");
  expect(result.componentKind).toBe("switch");
  expect(result.componentId).toBe(0);
  expect(result.channelCount).toBe(2);
  expect(result.state).toMatchObject({ on: true, power: 12.4, voltage: 230.1, current: 0.06 });
  expect(result.inputSupport).toBe(true);
});
