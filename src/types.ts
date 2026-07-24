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
  hidden: boolean;
  credentialMode: CredentialMode;
  credentialUsername?: string;
  passwordConfigured: boolean;
  lastSeen: string;
  lastEvent: string;
  adapterData?: Record<string, string | number | boolean | null>;
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


export interface OpenCcuSettings {
  baseUrl: string;
  username: string;
  passwordConfigured: boolean;
  encryptionStatus: "ok" | "invalid";
}

export type OpenCcuDiagnosticStepStatus = "ok" | "warning" | "error";

export interface OpenCcuDiagnosticStep {
  method: string;
  status: OpenCcuDiagnosticStepStatus;
  durationMs: number;
  interfaceName?: string;
  resultCount?: number;
  code?: string;
  remoteCode?: string;
  message?: string;
}

export interface OpenCcuDiagnosticReport {
  ok: boolean;
  startedAt: string;
  completedAt: string;
  baseUrl: string;
  interfaces: string[];
  steps: OpenCcuDiagnosticStep[];
}

export interface OpenCcuGatewayStatus {
  connected: boolean;
  interfaces: string[];
  devices: number;
  lastSync?: string;
  lastError?: string;
  lastErrorMethod?: string;
  lastErrorRemoteCode?: string;
  lastErrorMessage?: string;
  lastDiagnostic?: OpenCcuDiagnosticReport;
}

export type SystemLogLevel = "info" | "warning" | "error";

export interface SystemLogEntry {
  id: string;
  level: SystemLogLevel;
  source: string;
  code?: string;
  message: string;
  details: Record<string, unknown>;
  createdAt: string;
}
