export type DeviceType = "outlet" | "switch" | "energyMeter" | "windowCovering" | "light" | "motionSensor" | "contactSensor" | "temperatureSensor" | "humiditySensor" | "lightSensor" | "waterLeakSensor" | "smokeSensor" | "button" | "genericSensor";
export type DevicePresentationType = "auto" | "outlet" | "switch" | "light" | "fan";
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
  presentationType?: DevicePresentationType;
  name: string;
  host?: string;
  generation?: "gen1" | "gen2" | "gen3" | "gen4" | "rpc";
  model?: string;
  firmwareVersion?: string;
  hostname?: string;
  macAddress?: string;
  profile?: string;
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
  source: "api" | "homekit";
}

export interface ShellySettings {
  username: string;
  passwordConfigured: boolean;
  encryptionStatus: "ok" | "invalid";
  invalidDeviceCredentials: number;
}

export interface PhosconSettings {
  baseUrl: string;
  apiKeyConfigured: boolean;
  encryptionStatus: "ok" | "invalid";
}

export interface PhosconGatewayStatus {
  connected: boolean;
  name?: string;
  deviceName?: string;
  bridgeId?: string;
  apiVersion?: string;
  softwareVersion?: string;
  firmwareVersion?: string;
  zigbeeChannel?: number;
  rfConnected?: boolean;
  lastSync?: string;
  lastError?: string;
}
