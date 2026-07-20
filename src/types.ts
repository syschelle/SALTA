export type DeviceType = "outlet" | "switch" | "energyMeter" | "windowCovering" | "thermostat" | "light" | "motionSensor";
export type DeviceState = Record<string, string | number | boolean | null>;
export type CredentialMode = "inherit" | "custom" | "none";
export type ShellyComponentKind = "switch" | "light" | "cover" | "rgb" | "rgbw" | "cct" | "em" | "em1" | "pm1";

export interface Room {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  source: string;
  sourceId: string;
  type: DeviceType;
  name: string;
  host?: string;
  generation?: "gen1" | "gen2" | "gen3" | "gen4" | "rpc";
  model?: string;
  firmwareVersion?: string;
  hostname?: string;
  macAddress?: string;
  componentKind?: ShellyComponentKind;
  componentId?: number;
  channelCount?: number;
  powerMetering?: boolean;
  coverSupport?: boolean;
  switchSupport?: boolean;
  lightSupport?: boolean;
  inputSupport?: boolean;
  roomId?: string;
  room?: string;
  reachable: boolean;
  state: DeviceState;
  capabilities: string[];
  homekitEnabled: boolean;
  credentialMode: CredentialMode;
  credentialUsername?: string;
  passwordConfigured: boolean;
  lastSeen: string;
  lastEvent: string;
}

export interface DeviceCommand {
  deviceId: string;
  capability: string;
  value?: string | number | boolean;
  source: "api" | "homekit" | "ui";
}

export interface ShellySettings {
  username: string;
  passwordConfigured: boolean;
}
