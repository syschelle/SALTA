import { describe, expect, it } from "vitest";
import { normalizePhosconBaseUrl, parsePhosconWebSocketEvent, phosconDevicesFromState, phosconWebSocketUrl } from "./phoscon-core.js";

describe("normalizePhosconBaseUrl", () => {
  it("adds HTTP and removes trailing slashes", () => {
    expect(normalizePhosconBaseUrl("192.168.178.20:8080/"))
      .toBe("http://192.168.178.20:8080");
  });

  it("rejects credentials and unsupported protocols", () => {
    expect(() => normalizePhosconBaseUrl("http://user:secret@gateway.local"))
      .toThrow("PHOSCON_URL_INVALID");
    expect(() => normalizePhosconBaseUrl("file:///tmp/deconz"))
      .toThrow("PHOSCON_URL_INVALID");
  });
});

describe("phosconDevicesFromState", () => {
  const fullState = {
    config: {
      bridgeid: "00212EFFFF012345",
      name: "Phoscon-GW"
    },
    lights: {
      "1": {
        name: "Desk lamp",
        type: "Extended color light",
        modelid: "LCT001",
        uniqueid: "00:17:88:01:02:03:04:05-0b",
        swversion: "1.2.3",
        state: {
          on: true,
          bri: 127,
          reachable: true,
          lastupdated: "2026-07-23T08:00:00"
        }
      },
      "2": {
        name: "Living-room blind",
        type: "Window covering device",
        modelid: "Cover",
        uniqueid: "00:17:88:01:02:03:04:06-01",
        state: {
          lift: 25,
          reachable: true
        }
      }
    },
    sensors: {
      "10": {
        name: "Hall sensor",
        type: "ZHAPresence",
        modelid: "MultiSensor",
        uniqueid: "00:0d:6f:00:0a:0b:0c:0d-01-0406",
        state: {
          presence: true,
          lastupdated: "2026-07-23T08:01:00"
        },
        config: {
          battery: 87,
          reachable: true
        }
      },
      "11": {
        name: "Hall sensor",
        type: "ZHATemperature",
        modelid: "MultiSensor",
        uniqueid: "00:0d:6f:00:0a:0b:0c:0d-01-0402",
        state: {
          temperature: 2187,
          lastupdated: "2026-07-23T08:02:00"
        },
        config: {
          reachable: true
        }
      },
      "12": {
        name: "Hall sensor",
        type: "ZHALightLevel",
        modelid: "MultiSensor",
        uniqueid: "00:0d:6f:00:0a:0b:0c:0d-01-0400",
        state: {
          lux: 42,
          lastupdated: "2026-07-23T08:03:00"
        },
        config: {
          reachable: true
        }
      },
      "13": {
        name: "Desk lamp consumption",
        type: "ZHAPower",
        modelid: "LCT001",
        uniqueid: "00:17:88:01:02:03:04:05-01-0b04",
        state: {
          power: 7.4,
          lastupdated: "2026-07-23T08:04:00"
        },
        config: {
          reachable: true
        }
      },
      "1": {
        name: "Daylight",
        type: "Daylight",
        uniqueid: "daylight",
        state: { daylight: true }
      },
      "20": {
        name: "Virtual sensor",
        type: "CLIPGenericStatus",
        uniqueid: "virtual",
        state: { status: 1 }
      }
    }
  };

  it("maps lights, covers and one grouped physical sensor", () => {
    const devices = phosconDevicesFromState("http://192.168.178.20:8080", fullState);

    expect(devices).toHaveLength(3);
    expect(devices.find(device => device.name === "Desk lamp")).toMatchObject({
      source: "phoscon",
      sourceId: "light:1",
      type: "light",
      reachable: true,
      state: { on: true, brightness: 50, power: 7.4 },
      capabilities: ["turnOn", "turnOff", "toggle", "setBrightness"]
    });
    expect(devices.find(device => device.name === "Living-room blind")).toMatchObject({
      sourceId: "light:2",
      type: "windowCovering",
      state: { currentPosition: 75, targetPosition: 75 },
      capabilities: ["open", "close", "stop", "setTargetPosition"]
    });
    expect(devices.find(device => device.name === "Hall sensor")).toMatchObject({
      source: "phoscon",
      sourceId: "sensor:10,11,12",
      type: "motionSensor",
      state: {
        motion: true,
        temperature: 21.87,
        lux: 42,
        battery: 87
      },
      capabilities: []
    });
  });

  it("keeps device identifiers stable when the gateway URL changes", () => {
    const first = phosconDevicesFromState("http://192.168.178.20:8080", fullState);
    const second = phosconDevicesFromState("http://phoscon.local:8080", fullState);

    expect(second.map(device => device.id)).toEqual(first.map(device => device.id));
    expect(second.every(device => device.host === "http://phoscon.local:8080")).toBe(true);
  });

  it("imports deCONZ ZHASwitch resources as button devices", () => {
    const payload = {
      config: { bridgeid: "00212EFFFF012345", websocketport: 8088 },
      lights: {},
      sensors: {
        "30": {
          name: "Aqara Mini Switch",
          type: "ZHASwitch",
          modelid: "lumi.remote.b1acn01",
          uniqueid: "00:15:8d:00:01:02:03:04-01-0012",
          state: { buttonevent: 1002, lastupdated: "2026-08-09T16:00:00" },
          config: { battery: 91, reachable: true }
        }
      }
    };
    const devices = phosconDevicesFromState("http://192.168.178.20:8080", payload);
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({
      source: "phoscon",
      sourceId: "sensor:30",
      type: "button",
      model: "lumi.remote.b1acn01",
      reachable: true,
      state: { buttonEvent: 1002, battery: 91 },
      adapterData: { sensorResourceIds: "30", buttonEventProtocol: "deconz" }
    });
  });

  it("builds the deCONZ websocket URL and parses repeated button events", () => {
    expect(phosconWebSocketUrl("http://192.168.178.20:8080", { config: { websocketport: 8088 } }))
      .toBe("ws://192.168.178.20:8088/");
    expect(parsePhosconWebSocketEvent(JSON.stringify({
      t: "event", e: "changed", r: "sensors", id: "30",
      state: { buttonevent: 1002, lastupdated: "2026-08-09T16:00:00" }
    }))).toMatchObject({
      event: "changed", resource: "sensors", id: "30", state: { buttonevent: 1002 }
    });
  });

});
