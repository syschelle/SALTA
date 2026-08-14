import type { Device, DevicePresentationType, DeviceType } from "./types.js";

export type ResolvedPresentationType = Exclude<DevicePresentationType, "auto"> | DeviceType;

const SWITCHABLE_PHYSICAL_TYPES = new Set<DeviceType>(["switch", "outlet", "light"]);

export function supportsPresentationOverride(device: Device): boolean {
  return SWITCHABLE_PHYSICAL_TYPES.has(device.type)
    && device.capabilities.includes("turnOn")
    && device.capabilities.includes("turnOff");
}

export function resolvePresentationType(device: Device): ResolvedPresentationType {
  const configured = device.presentationType ?? "auto";
  if (configured !== "auto" && supportsPresentationOverride(device)) return configured;
  return device.type;
}

const HOMEKIT_SUPPORTED_TYPES = new Set<ResolvedPresentationType>([
  "outlet", "switch", "light", "fan", "windowCovering", "thermostat", "motionSensor", "contactSensor",
  "temperatureSensor", "humiditySensor", "lightSensor", "waterLeakSensor", "smokeSensor"
]);

function hasStateValue(device: Device, ...keys: string[]): boolean {
  return keys.some(key => device.state[key] !== undefined && device.state[key] !== null);
}

export function isHomeKitSupportedDevice(device: Device): boolean {
  const type = resolvePresentationType(device);
  if (!HOMEKIT_SUPPORTED_TYPES.has(type)) return false;
  if (type === "windowCovering") return device.capabilities.includes("setTargetPosition");
  if (type === "thermostat") {
    return device.capabilities.includes("setTargetTemperature") && device.capabilities.includes("setThermostatMode");
  }
  if (["outlet", "switch", "light", "fan"].includes(type)) {
    return device.capabilities.includes("turnOn") && device.capabilities.includes("turnOff");
  }
  if (type === "motionSensor") return hasStateValue(device, "motion");
  if (type === "contactSensor") return hasStateValue(device, "open");
  if (type === "temperatureSensor") return hasStateValue(device, "temperature");
  if (type === "humiditySensor") return hasStateValue(device, "humidity");
  if (type === "lightSensor") return hasStateValue(device, "lux", "lightlevel");
  if (type === "waterLeakSensor") return hasStateValue(device, "water", "alarm");
  if (type === "smokeSensor") return hasStateValue(device, "fire", "alarm");
  return false;
}

export function homeKitAccessoryName(device: Device): string {
  return device.homekitName?.trim() || device.name;
}
