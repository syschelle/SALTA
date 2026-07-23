import { hostname } from "node:os";
import { clearPhosconSettings, getPhosconConnection, updatePhosconSettings } from "./db.js";
import { gatewayStatus, normalizePhosconBaseUrl, phosconDevicesFromState, requestJson } from "./phoscon-core.js";
import type { Device, DeviceCommand, PhosconGatewayStatus } from "./types.js";
import type { DeviceRegistry } from "./registry.js";

const pollIntervalMs = 15_000;
const now = (): string => new Date().toISOString();

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export class PhosconAdapter {
  private timer?: NodeJS.Timeout;
  private reconcileTask?: Promise<void>;
  private configurationGeneration = 0;
  private status: PhosconGatewayStatus = { connected: false };

  constructor(private readonly registry: DeviceRegistry) {}

  start(): void {
    void this.reconcile().catch(() => undefined);
    this.timer = setInterval(() => void this.reconcile().catch(() => undefined), pollIntervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  getStatus(): PhosconGatewayStatus {
    return { ...this.status };
  }

  async configure(baseUrlInput: string, apiKey?: string): Promise<PhosconGatewayStatus> {
    const baseUrl = normalizePhosconBaseUrl(baseUrlInput);
    const providedKey = apiKey?.trim();
    const key = providedKey || (await getPhosconConnection()).apiKey;
    if (!key) throw new Error("PHOSCON_API_KEY_REQUIRED");
    const configPayload = await requestJson(`${baseUrl}/api/${encodeURIComponent(key)}/config`);
    await updatePhosconSettings(baseUrl, providedKey ? key : undefined);
    this.configurationGeneration += 1;
    this.status = gatewayStatus(configPayload);
    if (this.reconcileTask) await this.reconcileTask.catch(() => undefined);
    await this.reconcile();
    return this.getStatus();
  }

  async pair(baseUrlInput: string): Promise<PhosconGatewayStatus> {
    const baseUrl = normalizePhosconBaseUrl(baseUrlInput);
    const payload = await requestJson(`${baseUrl}/api`, "POST", { devicetype: `salta#${hostname().slice(0, 32)}` });
    const first = Array.isArray(payload) ? record(payload[0]) : {};
    const key = stringValue(record(first.success).username);
    if (!key) throw new Error("PHOSCON_PAIRING_FAILED");
    return this.configure(baseUrl, key);
  }

  async disconnect(): Promise<void> {
    this.configurationGeneration += 1;
    await clearPhosconSettings();
    if (this.reconcileTask) await this.reconcileTask.catch(() => undefined);
    await this.registry.removeSource("phoscon");
    this.status = { connected: false };
  }

  reconcile(): Promise<void> {
    if (this.reconcileTask) return this.reconcileTask;
    this.reconcileTask = this.performReconcile().finally(() => { this.reconcileTask = undefined; });
    return this.reconcileTask;
  }

  private async performReconcile(): Promise<void> {
    const generation = this.configurationGeneration;
    const connection = await getPhosconConnection();
    if (!connection.baseUrl || !connection.apiKey) {
      this.status = { connected: false };
      return;
    }
    try {
      const baseUrl = normalizePhosconBaseUrl(connection.baseUrl);
      const payload = await requestJson(`${baseUrl}/api/${encodeURIComponent(connection.apiKey)}`);
      if (generation !== this.configurationGeneration) return;
      const mapped = phosconDevicesFromState(baseUrl, payload);
      const seen = new Set(mapped.map(device => device.id));
      for (const discovered of mapped) {
        if (generation !== this.configurationGeneration) return;
        this.registry.restore(discovered.id);
        const existing = this.registry.get(discovered.id);
        await this.registry.set({
          ...discovered,
          name: existing?.name ?? discovered.name,
          roomId: existing?.roomId,
          room: existing?.room,
          presentationType: existing?.presentationType ?? discovered.presentationType,
          homekitEnabled: existing?.homekitEnabled ?? false,
          lastEvent: existing && JSON.stringify(existing.state) === JSON.stringify(discovered.state) ? existing.lastEvent : discovered.lastEvent
        });
      }
      for (const existing of this.registry.all().filter(device => device.source === "phoscon" && !seen.has(device.id))) {
        if (generation !== this.configurationGeneration) return;
        await this.registry.set({ ...existing, reachable: false, lastSeen: now() });
      }
      if (generation === this.configurationGeneration) this.status = gatewayStatus(payload);
    } catch (error) {
      if (generation !== this.configurationGeneration) return;
      const message = error instanceof Error ? error.message : "PHOSCON_SYNC_FAILED";
      this.status = { ...this.status, connected: false, lastError: message, lastSync: now() };
      for (const existing of this.registry.all().filter(device => device.source === "phoscon")) {
        await this.registry.set({ ...existing, reachable: false, lastSeen: now() });
      }
      throw error;
    }
  }

  async command(command: DeviceCommand): Promise<Device> {
    const device = this.registry.get(command.deviceId);
    if (!device || device.source !== "phoscon") throw new Error("DEVICE_NOT_FOUND");
    if (!device.capabilities.includes(command.capability)) throw new Error("CAPABILITY_NOT_SUPPORTED");
    const [kind, resourceId] = device.sourceId.split(":", 2);
    if (kind !== "light" || !resourceId) throw new Error("CAPABILITY_NOT_SUPPORTED");
    const connection = await getPhosconConnection();
    if (!connection.baseUrl || !connection.apiKey) throw new Error("PHOSCON_NOT_CONFIGURED");
    const baseUrl = normalizePhosconBaseUrl(connection.baseUrl);
    const state: Record<string, unknown> = {};
    if (command.capability === "toggle") state.on = !Boolean(device.state.on);
    else if (command.capability === "turnOn" || command.capability === "turnOff") state.on = command.capability === "turnOn";
    else if (command.capability === "setBrightness") {
      const brightness = Number(command.value);
      if (!Number.isFinite(brightness) || brightness < 0 || brightness > 100) throw new Error("INVALID_BRIGHTNESS");
      state.on = true;
      state.bri = Math.round((brightness / 100) * 254);
    } else if (command.capability === "open") state.open = true;
    else if (command.capability === "close") state.open = false;
    else if (command.capability === "stop") state.stop = true;
    else if (command.capability === "setTargetPosition") {
      const position = Number(command.value);
      if (!Number.isFinite(position) || position < 0 || position > 100) throw new Error("INVALID_POSITION");
      state.lift = 100 - Math.round(position);
    } else throw new Error("CAPABILITY_NOT_SUPPORTED");
    await requestJson(`${baseUrl}/api/${encodeURIComponent(connection.apiKey)}/lights/${encodeURIComponent(resourceId)}/state`, "PUT", state);
    if (this.reconcileTask) await this.reconcileTask.catch(() => undefined);
    await this.reconcile();
    return this.registry.get(command.deviceId) ?? device;
  }
}
