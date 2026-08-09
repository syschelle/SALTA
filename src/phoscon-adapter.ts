import { hostname } from "node:os";
import { clearPhosconSettings, getPhosconConnection, updatePhosconSettings, writeSystemLog } from "./db.js";
import {
  gatewayStatus,
  normalizePhosconBaseUrl,
  parsePhosconWebSocketEvent,
  phosconDevicesFromState,
  phosconSensorState,
  phosconWebSocketUrl,
  requestJson
} from "./phoscon-core.js";
import type { Device, DeviceCommand, PhosconGatewayStatus } from "./types.js";
import type { DeviceRegistry } from "./registry.js";

const pollIntervalMs = 15_000;
const reconnectMaxMs = 30_000;
const buttonFallbackIntervalMs = 2_000;
const now = (): string => new Date().toISOString();

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

async function webSocketPayloadText(value: unknown): Promise<string | undefined> {
  if (typeof value === "string") return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value).toString("utf8");
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("utf8");
  if (typeof Blob !== "undefined" && value instanceof Blob) return value.text();
  return undefined;
}

function sensorResourceIds(device: Device): string[] {
  if (device.source !== "phoscon") return [];
  const adapterIds = typeof device.adapterData?.sensorResourceIds === "string"
    ? device.adapterData.sensorResourceIds
    : undefined;
  const encoded = adapterIds ?? (device.sourceId.startsWith("sensor:") ? device.sourceId.slice("sensor:".length) : "");
  return encoded.split(",").map(value => value.trim()).filter(Boolean);
}

export class PhosconAdapter {
  private timer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private buttonFallbackTimer?: NodeJS.Timeout;
  private buttonFallbackTask?: Promise<void>;
  private reconcileTask?: Promise<void>;
  private configurationGeneration = 0;
  private status: PhosconGatewayStatus = { connected: false };
  private socket?: WebSocket;
  private socketUrl?: string;
  private reconnectAttempt = 0;
  private stopped = true;
  private readonly lastButtonEventSignature = new Map<string, string>();

  constructor(private readonly registry: DeviceRegistry) {}

  start(): void {
    this.stopped = false;
    void this.reconcile().catch(() => undefined);
    this.timer = setInterval(() => void this.reconcile().catch(() => undefined), pollIntervalMs);
    this.timer.unref();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.closeWebSocket();
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
    this.closeWebSocket();
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
    this.closeWebSocket();
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

  private closeWebSocket(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.stopButtonFallbackPolling();
    const socket = this.socket;
    this.socket = undefined;
    this.socketUrl = undefined;
    if (socket) {
      try { socket.close(); }
      catch { /* The REST reconciliation can recover if the socket was already invalid. */ }
    }
    this.status = { ...this.status, realtimeConnected: false, realtimeFallbackPolling: false };
  }

  private stopButtonFallbackPolling(): void {
    if (this.buttonFallbackTimer) clearInterval(this.buttonFallbackTimer);
    this.buttonFallbackTimer = undefined;
    this.status = { ...this.status, realtimeFallbackPolling: false };
  }

  private startButtonFallbackPolling(generation: number): void {
    if (this.stopped || generation !== this.configurationGeneration || this.buttonFallbackTimer) return;
    this.status = { ...this.status, realtimeFallbackPolling: true };
    const run = () => {
      if (this.stopped || generation !== this.configurationGeneration) return;
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.stopButtonFallbackPolling();
        return;
      }
      void this.pollButtonSensors(generation).catch(() => undefined);
    };
    run();
    this.buttonFallbackTimer = setInterval(run, buttonFallbackIntervalMs);
    this.buttonFallbackTimer.unref();
  }

  private async pollButtonSensors(generation: number): Promise<void> {
    if (this.buttonFallbackTask || this.stopped || generation !== this.configurationGeneration) return this.buttonFallbackTask;
    this.buttonFallbackTask = (async () => {
      const connection = await getPhosconConnection();
      if (!connection.baseUrl || !connection.apiKey) return;
      const baseUrl = normalizePhosconBaseUrl(connection.baseUrl);
      const payload = record(await requestJson(`${baseUrl}/api/${encodeURIComponent(connection.apiKey)}/sensors`));
      if (generation !== this.configurationGeneration) return;
      for (const device of this.registry.all().filter(candidate => candidate.source === "phoscon" && candidate.type === "button")) {
        for (const resourceId of sensorResourceIds(device)) {
          const sensor = record(payload[resourceId]);
          const state = record(sensor.state);
          if (numberValue(state.buttonevent) === undefined) continue;
          await this.applyButtonResource(resourceId, state, record(sensor.config), stringValue(sensor.name), "poll");
        }
      }
    })().finally(() => { this.buttonFallbackTask = undefined; });
    return this.buttonFallbackTask;
  }

  private async applyButtonResource(
    resourceId: string,
    rawState: Record<string, unknown>,
    rawConfig: Record<string, unknown>,
    name: string | undefined,
    transport: "websocket" | "poll"
  ): Promise<void> {
    let current = this.findSensorDevice(resourceId);
    if (!current) {
      await this.reconcile().catch(() => undefined);
      current = this.findSensorDevice(resourceId);
    }
    if (!current) return;

    const statePatch = phosconSensorState(rawState, rawConfig);
    const eventValue = numberValue(statePatch.buttonEvent);
    const lastUpdated = stringValue(rawState.lastupdated);
    const receivedAt = now();
    const priorLastUpdated = stringValue(current.adapterData?.buttonEventLastUpdated);
    const signature = eventValue === undefined ? undefined : `${eventValue}:${lastUpdated ?? receivedAt}`;
    const previousSignature = this.lastButtonEventSignature.get(resourceId);
    const shouldEmit = eventValue !== undefined && signature !== previousSignature && (
      transport === "websocket" || (Boolean(lastUpdated) && lastUpdated !== priorLastUpdated)
    );

    const reachable = typeof rawConfig.reachable === "boolean" ? rawConfig.reachable : current.reachable;
    const updated: Device = {
      ...current,
      name: name ?? current.name,
      reachable,
      state: { ...current.state, ...statePatch },
      adapterData: {
        ...(current.adapterData ?? {}),
        buttonEventProtocol: "deconz",
        buttonEventResourceId: resourceId,
        ...(lastUpdated ? { buttonEventLastUpdated: lastUpdated } : {}),
        buttonEventTransport: transport
      },
      lastSeen: receivedAt,
      lastEvent: eventValue !== undefined ? receivedAt : current.lastEvent
    };
    await this.registry.set(updated);

    if (signature) this.lastButtonEventSignature.set(resourceId, signature);
    if (!shouldEmit || eventValue === undefined) return;

    this.status = {
      ...this.status,
      realtimeLastEvent: receivedAt,
      realtimeLastError: undefined
    };
    this.registry.emitDeviceEvent({
      deviceId: updated.id,
      source: "phoscon",
      key: "buttonEvent",
      value: eventValue,
      receivedAt
    });
  }

  private scheduleReconnect(generation: number): void {
    if (this.stopped || generation !== this.configurationGeneration || this.reconnectTimer) return;
    const delay = Math.min(reconnectMaxMs, 1_000 * (2 ** Math.min(this.reconnectAttempt, 5)));
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.reconcile().catch(() => undefined);
    }, delay);
    this.reconnectTimer.unref();
  }

  private ensureWebSocket(baseUrl: string, payload: unknown, generation: number): void {
    if (this.stopped || generation !== this.configurationGeneration) return;
    const target = phosconWebSocketUrl(baseUrl, payload);
    if (!target) {
      this.status = { ...this.status, realtimeConnected: false, realtimeLastError: "PHOSCON_WEBSOCKET_PORT_UNAVAILABLE" };
      this.startButtonFallbackPolling(generation);
      return;
    }
    if (this.socket && this.socketUrl === target && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;

    const previous = this.socket;
    this.socket = undefined;
    this.socketUrl = target;
    this.status = { ...this.status, realtimeUrl: target, realtimeConnected: false, realtimeLastError: undefined };
    this.startButtonFallbackPolling(generation);
    if (previous) {
      try { previous.close(); }
      catch { /* Ignore stale socket shutdown failures. */ }
    }

    let socket: WebSocket;
    try {
      socket = new WebSocket(target);
    } catch (error) {
      const message = error instanceof Error ? error.message : "PHOSCON_WEBSOCKET_CONNECT_FAILED";
      this.status = { ...this.status, realtimeConnected: false, realtimeLastError: message };
      this.startButtonFallbackPolling(generation);
      this.scheduleReconnect(generation);
      return;
    }
    this.socket = socket;

    socket.addEventListener("open", () => {
      if (this.socket !== socket || generation !== this.configurationGeneration) return;
      this.reconnectAttempt = 0;
      this.stopButtonFallbackPolling();
      this.status = { ...this.status, realtimeConnected: true, realtimeUrl: target, realtimeLastError: undefined };
      void writeSystemLog("info", "phoscon", "PHOSCON_WEBSOCKET_CONNECTED", "Phoscon realtime WebSocket connected", { target }).catch(() => undefined);
    });
    socket.addEventListener("message", event => {
      if (this.socket !== socket || generation !== this.configurationGeneration) return;
      void this.handleWebSocketMessage(event.data).catch(() => undefined);
    });
    socket.addEventListener("error", () => {
      if (this.socket !== socket) return;
      this.status = { ...this.status, realtimeConnected: false, realtimeLastError: "PHOSCON_WEBSOCKET_ERROR" };
      this.startButtonFallbackPolling(generation);
      try { socket.close(); }
      catch { this.scheduleReconnect(generation); }
    });
    socket.addEventListener("close", () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.status = { ...this.status, realtimeConnected: false, realtimeLastError: "PHOSCON_WEBSOCKET_CLOSED" };
      this.startButtonFallbackPolling(generation);
      this.scheduleReconnect(generation);
    });
  }

  private findSensorDevice(resourceId: string): Device | undefined {
    return this.registry.all().find(device => device.source === "phoscon" && sensorResourceIds(device).includes(resourceId));
  }

  private async handleWebSocketMessage(data: unknown): Promise<void> {
    const text = await webSocketPayloadText(data);
    if (!text) return;
    const event = parsePhosconWebSocketEvent(text);
    if (!event) return;

    if (event.event === "added" || event.event === "deleted") {
      void this.reconcile().catch(() => undefined);
      return;
    }
    if (event.event !== "changed" || event.resource !== "sensors" || !event.id) return;

    const state = event.state ?? {};
    if (numberValue(state.buttonevent) !== undefined) {
      await this.applyButtonResource(event.id, state, event.config ?? {}, event.name, "websocket");
      return;
    }

    let current = this.findSensorDevice(event.id);
    if (!current) {
      await this.reconcile().catch(() => undefined);
      current = this.findSensorDevice(event.id);
    }
    if (!current) return;

    const statePatch = phosconSensorState(state, event.config ?? {});
    const reachable = typeof event.config?.reachable === "boolean" ? event.config.reachable : current.reachable;
    const receivedAt = now();
    const updated: Device = {
      ...current,
      name: event.name ?? current.name,
      reachable,
      state: { ...current.state, ...statePatch },
      lastSeen: receivedAt,
      lastEvent: Object.keys(statePatch).length ? receivedAt : current.lastEvent
    };
    await this.registry.set(updated);
  }

  private async performReconcile(): Promise<void> {
    const generation = this.configurationGeneration;
    const connection = await getPhosconConnection();
    if (!connection.baseUrl || !connection.apiKey) {
      this.closeWebSocket();
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
        const discoveredButtonUpdated = stringValue(discovered.adapterData?.buttonEventLastUpdated);
        const existingButtonUpdated = stringValue(existing?.adapterData?.buttonEventLastUpdated);
        const buttonEventChanged = discovered.type === "button" && Boolean(existingButtonUpdated) && Boolean(discoveredButtonUpdated) && discoveredButtonUpdated !== existingButtonUpdated;
        await this.registry.set({
          ...discovered,
          name: existing?.name ?? discovered.name,
          roomId: existing?.roomId,
          room: existing?.room,
          presentationType: existing?.presentationType ?? discovered.presentationType,
          homekitEnabled: existing?.homekitEnabled ?? false,
          hidden: existing?.hidden ?? false,
          lastEvent: buttonEventChanged ? discovered.lastEvent : existing && JSON.stringify(existing.state) === JSON.stringify(discovered.state) ? existing.lastEvent : discovered.lastEvent
        });
        if (discovered.type === "button") {
          const resourceId = stringValue(discovered.adapterData?.buttonEventResourceId);
          const eventValue = numberValue(discovered.state.buttonEvent);
          if (resourceId && eventValue !== undefined && discoveredButtonUpdated) {
            this.lastButtonEventSignature.set(resourceId, `${eventValue}:${discoveredButtonUpdated}`);
          }
        }
      }
      for (const existing of this.registry.all().filter(device => device.source === "phoscon" && !seen.has(device.id))) {
        if (generation !== this.configurationGeneration) return;
        await this.registry.set({ ...existing, reachable: false, lastSeen: now() });
      }
      if (generation === this.configurationGeneration) {
        this.status = {
          ...gatewayStatus(payload),
          realtimeConnected: this.status.realtimeConnected ?? false,
          realtimeUrl: this.status.realtimeUrl,
          realtimeLastEvent: this.status.realtimeLastEvent,
          realtimeLastError: this.status.realtimeLastError,
          realtimeFallbackPolling: this.status.realtimeFallbackPolling ?? false
        };
        this.ensureWebSocket(baseUrl, payload, generation);
      }
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
