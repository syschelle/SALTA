export type DeviceType = "outlet" | "switch" | "energyMeter" | "windowCovering" | "thermostat" | "light" | "motionSensor";
export type DeviceState = Record<string, string | number | boolean | null>;

export interface Device {
  id: string;
  source: string;
  sourceId: string;
  type: DeviceType;
  name: string;
  room?: string;
  reachable: boolean;
  state: DeviceState;
  capabilities: string[];
  homekitEnabled: boolean;
  lastSeen: string;
  lastEvent: string;
}

export interface DeviceCommand {
  deviceId: string;
  capability: string;
  value?: string | number | boolean;
  source: "api" | "homekit" | "ui";
}
