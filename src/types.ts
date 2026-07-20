export type DeviceType = "outlet" | "switch" | "energyMeter" | "windowCovering" | "thermostat" | "light" | "motionSensor";
export type DeviceState = Record<string, string | number | boolean | null>;
export type CredentialMode = "inherit" | "custom" | "none";

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
