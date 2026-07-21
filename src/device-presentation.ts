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
