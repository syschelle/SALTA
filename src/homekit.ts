import { randomBytes } from "node:crypto";
import { networkInterfaces as osNetworkInterfaces } from "node:os";
import {
  Accessory,
  AccessoryInfo,
  Bridge,
  Categories,
  Characteristic,
  HAPStorage,
  Service,
  uuid
} from "@homebridge/hap-nodejs";
import type { Device, DeviceCommand, HomeKitSettings, HomeKitStatus } from "./types.js";
import type { DeviceRegistry } from "./registry.js";
import { config } from "./config.js";
import { getHomeKitSettings, updateHomeKitSettings, writeSystemLog } from "./db.js";
import { homeKitAccessoryName, isHomeKitSupportedDevice, resolvePresentationType, type ResolvedPresentationType } from "./device-presentation.js";

const LEGACY_DEFAULT_USERNAME = "02:42:53:41:4C:54";
const LEGACY_DEFAULT_PIN = "031-45-154";
let hapStorageInitialized = false;

type Commander = { command(command: DeviceCommand): Promise<Device> };

type HomeKitPrimaryService =
  | "outlet"
  | "switch"
  | "light"
  | "fan"
  | "windowCovering"
  | "thermostat"
  | "motionSensor"
  | "contactSensor"
  | "temperatureSensor"
  | "humiditySensor"
  | "lightSensor"
  | "waterLeakSensor"
  | "smokeSensor";

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function generatedUsername(): string {
  const bytes = randomBytes(5);
  return [0x02, ...bytes].map(value => value.toString(16).padStart(2, "0").toUpperCase()).join(":");
}

function generatedPin(): string {
  while (true) {
    const digits = Array.from(randomBytes(8), value => String(value % 10)).join("");
    if (/^(\d)\1{7}$/.test(digits)) continue;
    if (["12345678", "87654321", "00000000"].includes(digits)) continue;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
}

function setupId(username: string): string {
  return username.replace(/:/g, "").slice(-4).toUpperCase();
}

function detectedNetworkInterfaces(): Array<{ name: string; addresses: string[] }> {
  return Object.entries(osNetworkInterfaces())
    .map(([name, entries]) => ({
      name,
      addresses: (entries ?? [])
        .filter(entry => !entry.internal)
        .map(entry => entry.address)
        .filter(Boolean)
    }))
    .filter(entry => entry.addresses.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function thermostatTargetMode(device: Device): number {
  const mode = String(device.state.controlMode ?? "manual").toLowerCase();
  if (mode === "off") return Characteristic.TargetHeatingCoolingState.OFF;
  if (mode === "auto") return Characteristic.TargetHeatingCoolingState.AUTO;
  return Characteristic.TargetHeatingCoolingState.HEAT;
}

function thermostatCurrentMode(device: Device): number {
  const mode = String(device.state.controlMode ?? "manual").toLowerCase();
  if (mode === "off") return Characteristic.CurrentHeatingCoolingState.OFF;
  const current = finiteNumber(device.state.temperature);
  const target = finiteNumber(device.state.targetTemperature);
  return current !== undefined && target !== undefined && target > current + 0.2
    ? Characteristic.CurrentHeatingCoolingState.HEAT
    : Characteristic.CurrentHeatingCoolingState.OFF;
}

function thermostatModeCommand(value: number): "off" | "manual" | "auto" {
  if (value === Characteristic.TargetHeatingCoolingState.OFF) return "off";
  if (value === Characteristic.TargetHeatingCoolingState.AUTO) return "auto";
  return "manual";
}

function typeForHomeKit(device: Device): HomeKitPrimaryService | undefined {
  const type = resolvePresentationType(device);
  return [
    "outlet", "switch", "light", "fan", "windowCovering", "thermostat", "motionSensor", "contactSensor",
    "temperatureSensor", "humiditySensor", "lightSensor", "waterLeakSensor", "smokeSensor"
  ].includes(type) ? type as HomeKitPrimaryService : undefined;
}

export class HomeKitBridge {
  private bridge?: Bridge;
  private accessories = new Map<string, Accessory>();
  private services = new Map<string, Service>();
  private accessoryTypes = new Map<string, ResolvedPresentationType>();
  private accessoryNames = new Map<string, string>();
  private settings?: HomeKitSettings;
  private running = false;
  private paired = false;
  private advertised = false;
  private listeningAddress?: string;
  private listeningPort?: number;
  private setupUri?: string;
  private activePin?: string;
  private lastError?: string;

  private readonly onDevice = (device: Device) => this.sync(device);
  private readonly onDeviceRemoved = (device: Device) => this.remove(device.id);

  constructor(private readonly registry: DeviceRegistry, private readonly commander: Commander) {
    this.registry.on("device", this.onDevice);
    this.registry.on("deviceRemoved", this.onDeviceRemoved);
  }

  private initializeStorage(): void {
    if (hapStorageInitialized) return;
    HAPStorage.setCustomStoragePath(config.HOMEKIT_STORAGE_PATH);
    hapStorageInitialized = true;
  }

  private pairingState(username: string): boolean {
    this.initializeStorage();
    try { return AccessoryInfo.load(username)?.paired() ?? false; }
    catch { return false; }
  }

  private accessoryInfoPin(username: string): string | undefined {
    this.initializeStorage();
    try {
      const pin = (AccessoryInfo.load(username) as unknown as { pincode?: unknown } | null)?.pincode;
      return typeof pin === "string" && /^\d{3}-\d{2}-\d{3}$/.test(pin) ? pin : undefined;
    } catch {
      return undefined;
    }
  }

  async start(): Promise<HomeKitStatus> {
    const settings = await getHomeKitSettings();
    this.settings = settings;
    if (!settings.enabled) return this.status();
    if (settings.encryptionStatus === "invalid" || !settings.pin) {
      this.lastError = "HOMEKIT_ENCRYPTION_KEY_MISMATCH";
      await writeSystemLog("error", "homekit", "HOMEKIT_ENCRYPTION_KEY_MISMATCH", "HomeKit pairing settings could not be decrypted").catch(() => undefined);
      return this.status();
    }
    await this.publish(settings);
    return this.status();
  }

  private async publish(settings: HomeKitSettings): Promise<void> {
    if (this.running) await this.stop();
    this.initializeStorage();
    this.lastError = undefined;
    this.advertised = false;
    this.listeningAddress = undefined;
    this.listeningPort = undefined;
    this.setupUri = undefined;
    this.activePin = undefined;

    const bridge = new Bridge(settings.name, uuid.generate("salta:bridge"));
    bridge.getService(Service.AccessoryInformation)
      ?.setCharacteristic(Characteristic.Manufacturer, "SALTA")
      .setCharacteristic(Characteristic.Model, "SALTA HomeKit Bridge")
      .setCharacteristic(Characteristic.FirmwareRevision, "0.8.94")
      .setCharacteristic(Characteristic.SerialNumber, settings.username.replace(/:/g, ""));
    bridge.on("listening", (port, address) => {
      this.listeningPort = port;
      this.listeningAddress = address;
    });
    bridge.on("advertised", () => { this.advertised = true; });
    bridge.on("paired", () => {
      this.paired = true;
      void writeSystemLog("info", "homekit", "HOMEKIT_PAIRED", "SALTA HomeKit bridge paired successfully").catch(() => undefined);
    });
    bridge.on("unpaired", () => {
      this.paired = false;
      void writeSystemLog("info", "homekit", "HOMEKIT_UNPAIRED", "SALTA HomeKit bridge is no longer paired").catch(() => undefined);
    });
    bridge.on("characteristic-warning", warning => {
      void writeSystemLog("warning", "homekit", "HOMEKIT_CHARACTERISTIC_WARNING", "HomeKit reported a characteristic warning", {
        type: warning.type,
        message: warning.message
      }).catch(() => undefined);
    });

    this.bridge = bridge;
    this.accessories.clear();
    this.services.clear();
    this.accessoryTypes.clear();
    this.accessoryNames.clear();
    for (const device of this.registry.all()) this.sync(device);

    try {
      await bridge.publish({
        username: settings.username,
        pincode: settings.pin,
        port: config.HOMEKIT_PORT,
        category: Categories.BRIDGE,
        setupID: setupId(settings.username),
        ...(settings.networkInterface ? { bind: settings.networkInterface } : {})
      });
      this.running = true;
      this.paired = this.pairingState(settings.username);
      this.activePin = this.accessoryInfoPin(settings.username) ?? settings.pin;
      this.setupUri = bridge.setupURI();
      await writeSystemLog("info", "homekit", "HOMEKIT_STARTED", "SALTA HomeKit bridge started", {
        name: settings.name,
        port: config.HOMEKIT_PORT,
        networkInterface: settings.networkInterface || "all",
        paired: this.paired,
        publishedDevices: this.accessories.size
      }).catch(() => undefined);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.running = false;
      try { await bridge.unpublish(); } catch { /* Best effort cleanup after failed publish. */ }
      this.bridge = undefined;
      this.accessories.clear();
      this.services.clear();
      await writeSystemLog("error", "homekit", "HOMEKIT_START_FAILED", "SALTA HomeKit bridge could not start", {
        error: this.lastError
      }).catch(() => undefined);
      throw error;
    }
  }

  async stop(): Promise<void> {
    const bridge = this.bridge;
    this.bridge = undefined;
    this.running = false;
    this.advertised = false;
    this.listeningAddress = undefined;
    this.listeningPort = undefined;
    this.setupUri = undefined;
    this.activePin = undefined;
    this.accessories.clear();
    this.services.clear();
    this.accessoryTypes.clear();
    this.accessoryNames.clear();
    if (bridge) await bridge.unpublish();
  }

  async configure(input: { enabled: boolean; name: string; networkInterface?: string }): Promise<HomeKitStatus> {
    const current = await getHomeKitSettings();
    if (current.encryptionStatus === "invalid") throw new Error("HOMEKIT_ENCRYPTION_KEY_MISMATCH");
    const networkInterface = input.networkInterface?.trim() ?? "";
    if (networkInterface && !detectedNetworkInterfaces().some(entry => entry.name === networkInterface)) {
      throw new Error("HOMEKIT_NETWORK_INTERFACE_INVALID");
    }
    const alreadyPaired = this.pairingState(current.username);
    let username = current.username;
    let pin = current.pin;
    if (input.enabled && !alreadyPaired && username.toUpperCase() === LEGACY_DEFAULT_USERNAME) username = generatedUsername();
    if (input.enabled && !alreadyPaired && pin === LEGACY_DEFAULT_PIN) pin = generatedPin();
    const settings = await updateHomeKitSettings({
      enabled: input.enabled,
      name: input.name,
      username,
      pin,
      networkInterface
    });
    this.settings = settings;
    await this.stop();
    if (settings.enabled) await this.publish(settings);
    await writeSystemLog("info", "homekit", settings.enabled ? "HOMEKIT_ENABLED" : "HOMEKIT_DISABLED", settings.enabled ? "HomeKit integration enabled" : "HomeKit integration disabled", {
      name: settings.name,
      networkInterface: settings.networkInterface || "all"
    }).catch(() => undefined);
    return this.status();
  }

  async resetPairing(): Promise<HomeKitStatus> {
    const current = await getHomeKitSettings();
    await this.stop();
    this.initializeStorage();
    Bridge.cleanupAccessoryData(current.username);
    const settings = await updateHomeKitSettings({
      enabled: current.enabled,
      name: current.name,
      username: generatedUsername(),
      pin: generatedPin(),
      networkInterface: current.networkInterface
    });
    this.settings = settings;
    this.paired = false;
    if (settings.enabled) await this.publish(settings);
    await writeSystemLog("warning", "homekit", "HOMEKIT_PAIRING_RESET", "HomeKit pairing data was reset").catch(() => undefined);
    return this.status();
  }

  async status(): Promise<HomeKitStatus> {
    const settings = this.settings ?? await getHomeKitSettings();
    this.settings = settings;
    if (!this.running) {
      this.paired = this.pairingState(settings.username);
      this.activePin = !this.paired ? (this.accessoryInfoPin(settings.username) ?? settings.pin) : undefined;
    }
    const supportedDevices = this.registry.all().filter(isHomeKitSupportedDevice).length;
    const publishedDevices = this.running ? this.accessories.size : 0;
    return {
      ...settings,
      pin: !this.paired ? (this.activePin ?? settings.pin) : settings.pin,
      running: this.running,
      paired: this.paired,
      advertised: this.advertised,
      ...(this.listeningAddress ? { listeningAddress: this.listeningAddress } : {}),
      ...(this.listeningPort ? { listeningPort: this.listeningPort } : {}),
      port: config.HOMEKIT_PORT,
      ...(!this.paired && this.setupUri ? { setupUri: this.setupUri } : {}),
      ...(this.lastError ? { lastError: this.lastError } : {}),
      supportedDevices,
      publishedDevices,
      networkInterfaces: detectedNetworkInterfaces()
    };
  }

  private remove(deviceId: string): void {
    const accessory = this.accessories.get(deviceId);
    if (accessory && this.bridge) this.bridge.removeBridgedAccessory(accessory);
    this.accessories.delete(deviceId);
    this.services.delete(deviceId);
    this.accessoryTypes.delete(deviceId);
    this.accessoryNames.delete(deviceId);
  }

  private sync(device: Device): void {
    if (!this.bridge) return;
    if (!device.homekitEnabled || device.hidden || !isHomeKitSupportedDevice(device)) {
      this.remove(device.id);
      return;
    }
    const serviceType = resolvePresentationType(device);
    const accessoryName = homeKitAccessoryName(device);
    let accessory = this.accessories.get(device.id);
    if (accessory && (this.accessoryTypes.get(device.id) !== serviceType || this.accessoryNames.get(device.id) !== accessoryName)) {
      this.bridge.removeBridgedAccessory(accessory);
      this.accessories.delete(device.id);
      this.services.delete(device.id);
      this.accessoryTypes.delete(device.id);
      this.accessoryNames.delete(device.id);
      accessory = undefined;
    }
    if (!accessory) {
      accessory = new Accessory(accessoryName, uuid.generate(`salta:${device.id}`));
      accessory.reachable = device.reachable;
      accessory.getService(Service.AccessoryInformation)
        ?.setCharacteristic(Characteristic.Manufacturer, "SALTA")
        .setCharacteristic(Characteristic.Model, device.model || `SALTA ${device.source}`)
        .setCharacteristic(Characteristic.SerialNumber, device.macAddress || device.sourceId)
        .setCharacteristic(Characteristic.FirmwareRevision, device.firmwareVersion || "0.8.94");
      const primary = this.addService(accessory, device, serviceType, accessoryName);
      if (!primary) return;
      this.addBatteryService(accessory, device);
      this.bridge.addBridgedAccessory(accessory);
      this.accessories.set(device.id, accessory);
      this.services.set(device.id, primary);
      this.accessoryTypes.set(device.id, serviceType);
      this.accessoryNames.set(device.id, accessoryName);
    }
    accessory.reachable = device.reachable;
    const service = this.services.get(device.id);
    if (!service) return;
    this.updateService(service, device, typeForHomeKit(device));
    this.updateBatteryService(accessory, device);
  }

  private command(device: Device, capability: string, value?: string | number | boolean): Promise<void> {
    return this.commander.command({ deviceId: device.id, capability, value, source: "homekit" }).then(() => undefined);
  }

  private addService(accessory: Accessory, device: Device, serviceType: ResolvedPresentationType, name: string): Service | undefined {
    let service: Service;
    switch (serviceType) {
      case "outlet": service = accessory.addService(Service.Outlet, name); break;
      case "switch": service = accessory.addService(Service.Switch, name); break;
      case "light": service = accessory.addService(Service.Lightbulb, name); break;
      case "fan": service = accessory.addService(Service.Fanv2, name); break;
      case "windowCovering": service = accessory.addService(Service.WindowCovering, name); break;
      case "thermostat": service = accessory.addService(Service.Thermostat, name); break;
      case "motionSensor": service = accessory.addService(Service.MotionSensor, name); break;
      case "contactSensor": service = accessory.addService(Service.ContactSensor, name); break;
      case "temperatureSensor": service = accessory.addService(Service.TemperatureSensor, name); break;
      case "humiditySensor": service = accessory.addService(Service.HumiditySensor, name); break;
      case "lightSensor": service = accessory.addService(Service.LightSensor, name); break;
      case "waterLeakSensor": service = accessory.addService(Service.LeakSensor, name); break;
      case "smokeSensor": service = accessory.addService(Service.SmokeSensor, name); break;
      default: return undefined;
    }

    if (device.capabilities.includes("turnOn")) {
      if (serviceType === "fan") service.getCharacteristic(Characteristic.Active).onSet(value => this.command(device, Number(value) === Characteristic.Active.ACTIVE ? "turnOn" : "turnOff"));
      else if (["outlet", "switch", "light"].includes(serviceType)) service.getCharacteristic(Characteristic.On).onSet(value => this.command(device, value ? "turnOn" : "turnOff"));
    }
    if (serviceType === "light" && device.capabilities.includes("setBrightness")) {
      service.getCharacteristic(Characteristic.Brightness).onSet(value => this.command(device, "setBrightness", Number(value)));
    }
    if (serviceType === "windowCovering" && device.capabilities.includes("setTargetPosition")) {
      service.getCharacteristic(Characteristic.TargetPosition).onSet(value => this.command(device, "setTargetPosition", Number(value)));
    }
    if (serviceType === "thermostat") {
      const minimum = finiteNumber(device.adapterData?.targetTemperatureMin) ?? 4.5;
      const maximum = finiteNumber(device.adapterData?.targetTemperatureMax) ?? 30;
      const step = finiteNumber(device.adapterData?.targetTemperatureStep) ?? 0.5;
      service.getCharacteristic(Characteristic.TargetTemperature)
        .setProps({ minValue: minimum, maxValue: maximum, minStep: step })
        .onSet(value => this.command(device, "setTargetTemperature", Number(value)));
      service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .setProps({ validValues: [
          Characteristic.TargetHeatingCoolingState.OFF,
          Characteristic.TargetHeatingCoolingState.HEAT,
          Characteristic.TargetHeatingCoolingState.AUTO
        ] })
        .onSet(value => this.command(device, "setThermostatMode", thermostatModeCommand(Number(value))));
      service.setCharacteristic(Characteristic.TemperatureDisplayUnits, Characteristic.TemperatureDisplayUnits.CELSIUS);
    }
    return service;
  }

  private updateService(service: Service, device: Device, serviceType: HomeKitPrimaryService | undefined): void {
    if (!serviceType) return;
    if (serviceType === "fan") {
      const on = booleanValue(device.state.on);
      if (on !== undefined) service.updateCharacteristic(Characteristic.Active, on ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE);
      return;
    }
    if (["outlet", "switch", "light"].includes(serviceType)) {
      const on = booleanValue(device.state.on);
      if (on !== undefined) service.updateCharacteristic(Characteristic.On, on);
      if (serviceType === "outlet" && on !== undefined) service.updateCharacteristic(Characteristic.OutletInUse, on);
      if (serviceType === "light") {
        const brightness = finiteNumber(device.state.brightness);
        if (brightness !== undefined) service.updateCharacteristic(Characteristic.Brightness, Math.max(0, Math.min(100, brightness)));
      }
      return;
    }
    if (serviceType === "windowCovering") {
      const current = finiteNumber(device.state.currentPosition);
      const target = finiteNumber(device.state.targetPosition);
      if (current !== undefined) service.updateCharacteristic(Characteristic.CurrentPosition, Math.max(0, Math.min(100, current)));
      if (target !== undefined) service.updateCharacteristic(Characteristic.TargetPosition, Math.max(0, Math.min(100, target)));
      const positionState = String(device.state.positionState ?? "").toLowerCase();
      const hapPosition = positionState.includes("open") || positionState.includes("up")
        ? Characteristic.PositionState.INCREASING
        : positionState.includes("close") || positionState.includes("down")
          ? Characteristic.PositionState.DECREASING
          : Characteristic.PositionState.STOPPED;
      service.updateCharacteristic(Characteristic.PositionState, hapPosition);
      return;
    }
    if (serviceType === "thermostat") {
      const current = finiteNumber(device.state.temperature);
      const target = finiteNumber(device.state.targetTemperature);
      if (current !== undefined) service.updateCharacteristic(Characteristic.CurrentTemperature, current);
      if (target !== undefined) service.updateCharacteristic(Characteristic.TargetTemperature, target);
      service.updateCharacteristic(Characteristic.CurrentHeatingCoolingState, thermostatCurrentMode(device));
      service.updateCharacteristic(Characteristic.TargetHeatingCoolingState, thermostatTargetMode(device));
      const humidity = finiteNumber(device.state.humidity);
      if (humidity !== undefined) service.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(Math.max(0, Math.min(100, humidity)));
      return;
    }
    if (serviceType === "motionSensor") {
      const motion = booleanValue(device.state.motion);
      if (motion !== undefined) service.updateCharacteristic(Characteristic.MotionDetected, motion);
    } else if (serviceType === "contactSensor") {
      const open = booleanValue(device.state.open);
      if (open !== undefined) service.updateCharacteristic(Characteristic.ContactSensorState, open ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED);
    } else if (serviceType === "temperatureSensor") {
      const temperature = finiteNumber(device.state.temperature);
      if (temperature !== undefined) service.updateCharacteristic(Characteristic.CurrentTemperature, temperature);
    } else if (serviceType === "humiditySensor") {
      const humidity = finiteNumber(device.state.humidity);
      if (humidity !== undefined) service.updateCharacteristic(Characteristic.CurrentRelativeHumidity, Math.max(0, Math.min(100, humidity)));
    } else if (serviceType === "lightSensor") {
      const lux = finiteNumber(device.state.lux) ?? finiteNumber(device.state.lightlevel);
      if (lux !== undefined) service.updateCharacteristic(Characteristic.CurrentAmbientLightLevel, Math.max(0.0001, Math.min(100000, lux)));
    } else if (serviceType === "waterLeakSensor") {
      const water = booleanValue(device.state.water) ?? booleanValue(device.state.alarm);
      if (water !== undefined) service.updateCharacteristic(Characteristic.LeakDetected, water ? Characteristic.LeakDetected.LEAK_DETECTED : Characteristic.LeakDetected.LEAK_NOT_DETECTED);
    } else if (serviceType === "smokeSensor") {
      const fire = booleanValue(device.state.fire) ?? booleanValue(device.state.alarm);
      if (fire !== undefined) service.updateCharacteristic(Characteristic.SmokeDetected, fire ? Characteristic.SmokeDetected.SMOKE_DETECTED : Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
    }
  }

  private addBatteryService(accessory: Accessory, device: Device): void {
    if (finiteNumber(device.state.battery) === undefined && booleanValue(device.state.lowBattery) === undefined) return;
    accessory.addService(Service.Battery, `${homeKitAccessoryName(device)} Batterie`);
  }

  private updateBatteryService(accessory: Accessory, device: Device): void {
    const battery = finiteNumber(device.state.battery);
    const low = booleanValue(device.state.lowBattery);
    let service = accessory.getService(Service.Battery);
    if (!service && (battery !== undefined || low !== undefined)) service = accessory.addService(Service.Battery, `${homeKitAccessoryName(device)} Batterie`);
    if (!service) return;
    if (battery !== undefined) service.updateCharacteristic(Characteristic.BatteryLevel, Math.max(0, Math.min(100, Math.round(battery))));
    service.updateCharacteristic(Characteristic.StatusLowBattery, low || (battery !== undefined && battery <= 20) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    service.updateCharacteristic(Characteristic.ChargingState, booleanValue(device.state.charging) ? Characteristic.ChargingState.CHARGING : Characteristic.ChargingState.NOT_CHARGING);
  }
}
