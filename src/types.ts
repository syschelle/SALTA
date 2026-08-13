export type DeviceType = "outlet" | "switch" | "energyMeter" | "windowCovering" | "light" | "thermostat" | "motionSensor" | "contactSensor" | "temperatureSensor" | "humiditySensor" | "lightSensor" | "waterLeakSensor" | "smokeSensor" | "button" | "genericSensor";
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
  homekitName?: string;
  homekitUseSaltaRoom?: boolean;
  homekitRoomId?: string;
  homekitRoom?: string;
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
  source: "api" | "homekit" | "automation" | "system";
}

export interface DeviceEvent {
  deviceId: string;
  source: string;
  key: string;
  value: string | number | boolean;
  receivedAt: string;
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
  realtimeConnected?: boolean;
  realtimeUrl?: string;
  realtimeLastEvent?: string;
  realtimeLastError?: string;
  realtimeFallbackPolling?: boolean;
}


export interface OpenCcuSettings {
  baseUrl: string;
  username: string;
  passwordConfigured: boolean;
  encryptionStatus: "ok" | "invalid";
}

export interface FritzBoxPresenceSettings {
  baseUrl: string;
  username: string;
  passwordConfigured: boolean;
  encryptionStatus: "ok" | "invalid";
  enabled: boolean;
  pollIntervalSeconds: number;
  absenceDelaySeconds: number;
  tlsInsecure: boolean;
}

export interface PresenceTarget {
  id: string;
  name: string;
  macAddress: string;
  absenceDelaySeconds?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FritzBoxPresenceStatus {
  connected: boolean;
  enabled: boolean;
  hostCount?: number;
  lastSync?: string;
  lastError?: string;
  lastTestAt?: string;
  lastTestSuccess?: boolean;
  lastTestHostCount?: number;
  lastTestError?: string;
  lastTestBaseUrl?: string;
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

export type ClimateMode = "summer" | "winter";
export type WinterThermostatMode = "manual" | "auto";

export interface ClimateModeSettings {
  mode: ClimateMode;
  winterMode: WinterThermostatMode;
  lastAppliedAt?: string;
  lastResult?: { total: number; succeeded: number; failed: number };
}

export interface PushoverSettings {
  enabled: boolean;
  userKeyConfigured: boolean;
  apiTokenConfigured: boolean;
  encryptionStatus: "ok" | "invalid";
  batteryThreshold: number;
}

export interface BatteryWarningDevice {
  deviceId: string;
  name: string;
  room?: string;
  battery?: number;
  lowBattery: boolean;
}

export interface SystemLogEntry {
  id: string;
  level: SystemLogLevel;
  source: string;
  code?: string;
  message: string;
  details: Record<string, unknown>;
  createdAt: string;
}
