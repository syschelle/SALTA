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

const HOMEKIT_SUPPORTED_TYPES = new Set<ResolvedPresentationType>(["outlet", "switch", "light", "fan", "windowCovering"]);

export function isHomeKitSupportedDevice(device: Device): boolean {
  const type = resolvePresentationType(device);
  if (!HOMEKIT_SUPPORTED_TYPES.has(type)) return false;
  if (type === "windowCovering") return device.capabilities.includes("setTargetPosition");
  return device.capabilities.includes("turnOn") && device.capabilities.includes("turnOff");
}

export function homeKitAccessoryName(device: Device): string {
  return device.homekitName?.trim() || device.name;
}
