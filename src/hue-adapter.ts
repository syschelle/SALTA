import https from "node:https";
import { hostname } from "node:os";
import { clearHueSettings, getHueConnection, updateHueSettings, writeSystemLog } from "./db.js";
import { hueApplicationKeyFromPairing, hueBridgeInfo, hueDevicesFromResources, hexToHueXy, hueRequestJson, normalizeHueBaseUrl, type HueBridgeInfo } from "./hue-core.js";
import { hueHttpsRequestOptions } from "./hue-tls.js";
import { discoverHueBridges, type DiscoveredHueBridge } from "./hue-mdns.js";
import type { Device, DeviceCommand } from "./types.js";
import type { DeviceRegistry } from "./registry.js";

type DiscoveredHueBridgeInfo = HueBridgeInfo & { bridgeId: string };

const pollIntervalMs = 15_000;
const reconnectMaxMs = 30_000;
const now = (): string => new Date().toISOString();

export class HueAdapter {
  private timer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private reconcileTimer?: NodeJS.Timeout;
  private streamRequest?: ReturnType<typeof https.request>;
  private reconcileTask?: Promise<void>;
  private configurationGeneration = 0;
  private reconnectAttempt = 0;
  private stopped = true;
  private status: HueBridgeInfo = { connected: false };

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
    this.closeEventStream();
  }

  getStatus(): HueBridgeInfo {
    return { ...this.status };
  }

  discover(): Promise<DiscoveredHueBridge[]> {
    return discoverHueBridges();
  }

  private async discoverBridge(baseUrl: string): Promise<DiscoveredHueBridgeInfo> {
    // Bridge discovery deliberately performs CA validation before the bridge id is known.
    // Once the id has been read, all authenticated requests validate the certificate hostname too.
    const payload = await hueRequestJson(`${baseUrl}/api/config`, { allowBridgeDiscovery: true });
    const info = hueBridgeInfo(payload);
    if (!info.bridgeId) throw new Error("HUE_INVALID_RESPONSE");
    return { ...info, bridgeId: info.bridgeId };
  }

  async pair(baseUrlInput: string): Promise<HueBridgeInfo> {
    const baseUrl = normalizeHueBaseUrl(baseUrlInput);
    const bridge = await this.discoverBridge(baseUrl);
    const payload = await hueRequestJson(`${baseUrl}/api`, {
      method: "POST",
      bridgeId: bridge.bridgeId,
      body: { devicetype: `salta#${hostname().slice(0, 32)}`, generateclientkey: true }
    });
    const applicationKey = hueApplicationKeyFromPairing(payload);
    return this.configure(baseUrl, applicationKey);
  }

  async configure(baseUrlInput: string, applicationKeyInput?: string): Promise<HueBridgeInfo> {
    const baseUrl = normalizeHueBaseUrl(baseUrlInput);
    const stored = await getHueConnection();
    const applicationKey = applicationKeyInput?.trim() || stored.applicationKey;
    if (!applicationKey) throw new Error("HUE_APPLICATION_KEY_REQUIRED");
    const bridge = await this.discoverBridge(baseUrl);
    const configPayload = await hueRequestJson(`${baseUrl}/api/${encodeURIComponent(applicationKey)}/config`, { bridgeId: bridge.bridgeId });
    const resourcePayload = await hueRequestJson(`${baseUrl}/clip/v2/resource`, { applicationKey, bridgeId: bridge.bridgeId });
    const info = hueBridgeInfo(configPayload);
    if (!info.bridgeId || info.bridgeId.toLowerCase() !== bridge.bridgeId.toLowerCase()) throw new Error("HUE_BRIDGE_ID_MISMATCH");
    await updateHueSettings(baseUrl, applicationKeyInput?.trim() ? applicationKey : undefined);
    this.configurationGeneration += 1;
    this.closeEventStream();
    await this.applyResources(baseUrl, info.bridgeId, resourcePayload);
    this.status = { ...info, realtimeConnected: false };
    void this.ensureEventStream(baseUrl, applicationKey, info.bridgeId, this.configurationGeneration).catch(() => undefined);
    await writeSystemLog("info", "hue", "HUE_CONNECTED", "Philips Hue Bridge connected", { bridgeId: info.bridgeId, name: info.name ?? "Hue Bridge" }).catch(() => undefined);
    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    this.configurationGeneration += 1;
    this.closeEventStream();
    await clearHueSettings();
    if (this.reconcileTask) await this.reconcileTask.catch(() => undefined);
    await this.registry.removeSource("hue");
    this.status = { connected: false };
    await writeSystemLog("info", "hue", "HUE_DISCONNECTED", "Philips Hue Bridge disconnected").catch(() => undefined);
  }

  reconcile(): Promise<void> {
    if (this.reconcileTask) return this.reconcileTask;
    this.reconcileTask = this.performReconcile().finally(() => { this.reconcileTask = undefined; });
    return this.reconcileTask;
  }

  private async performReconcile(): Promise<void> {
    const generation = this.configurationGeneration;
    const connection = await getHueConnection();
    if (!connection.baseUrl || !connection.applicationKey) {
      this.closeEventStream();
      this.status = { connected: false };
      return;
    }
    try {
      const baseUrl = normalizeHueBaseUrl(connection.baseUrl);
      const bridge = await this.discoverBridge(baseUrl);
      const configPayload = await hueRequestJson(`${baseUrl}/api/${encodeURIComponent(connection.applicationKey)}/config`, { bridgeId: bridge.bridgeId });
      const info = hueBridgeInfo(configPayload);
      if (!info.bridgeId || info.bridgeId.toLowerCase() !== bridge.bridgeId.toLowerCase()) throw new Error("HUE_BRIDGE_ID_MISMATCH");
      const resourcePayload = await hueRequestJson(`${baseUrl}/clip/v2/resource`, { applicationKey: connection.applicationKey, bridgeId: info.bridgeId });
      if (generation !== this.configurationGeneration) return;
      await this.applyResources(baseUrl, info.bridgeId, resourcePayload);
      this.status = {
        ...info,
        realtimeConnected: this.status.realtimeConnected ?? false,
        realtimeLastEvent: this.status.realtimeLastEvent,
        realtimeLastError: this.status.realtimeLastError
      };
      void this.ensureEventStream(baseUrl, connection.applicationKey, info.bridgeId, generation).catch(() => undefined);
    } catch (error) {
      if (generation !== this.configurationGeneration) return;
      const message = error instanceof Error ? error.message : "HUE_REQUEST_FAILED";
      this.status = { ...this.status, connected: false, lastError: message, lastSync: now(), realtimeConnected: false };
      for (const existing of this.registry.all().filter(device => device.source === "hue")) {
        await this.registry.set({ ...existing, reachable: false, lastSeen: now() });
      }
      await writeSystemLog("warning", "hue", message, "Philips Hue Bridge synchronization failed").catch(() => undefined);
      throw error;
    }
  }

  private async applyResources(baseUrl: string, bridgeId: string, payload: unknown): Promise<void> {
    const mapped = hueDevicesFromResources(baseUrl, bridgeId, payload);
    const seen = new Set(mapped.map(device => device.id));
    for (const discovered of mapped) {
      this.registry.restore(discovered.id);
      const existing = this.registry.get(discovered.id);
      const stateChanged = existing ? JSON.stringify(existing.state) !== JSON.stringify(discovered.state) : true;
      await this.registry.set({
        ...discovered,
        name: existing?.name ?? discovered.name,
        roomId: existing?.roomId,
        room: existing?.room,
        presentationType: existing?.presentationType ?? discovered.presentationType,
        homekitEnabled: existing?.homekitEnabled ?? false,
        hidden: existing?.hidden ?? false,
        lastEvent: existing && !stateChanged ? existing.lastEvent : discovered.lastEvent
      });
    }
    for (const existing of this.registry.all().filter(device => device.source === "hue" && !seen.has(device.id))) {
      await this.registry.set({ ...existing, reachable: false, lastSeen: now() });
    }
  }

  private closeEventStream(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    this.reconnectTimer = undefined;
    this.reconcileTimer = undefined;
    const request = this.streamRequest;
    this.streamRequest = undefined;
    if (request) request.destroy();
    this.status = { ...this.status, realtimeConnected: false };
  }

  private scheduleReconcileFromEvent(): void {
    if (this.reconcileTimer) return;
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = undefined;
      void this.reconcile().catch(() => undefined);
    }, 150);
    this.reconcileTimer.unref();
  }

  private scheduleReconnect(baseUrl: string, applicationKey: string, bridgeId: string, generation: number): void {
    if (this.stopped || generation !== this.configurationGeneration || this.reconnectTimer) return;
    const delay = Math.min(reconnectMaxMs, 1_000 * (2 ** Math.min(this.reconnectAttempt, 5)));
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.ensureEventStream(baseUrl, applicationKey, bridgeId, generation).catch(() => undefined);
    }, delay);
    this.reconnectTimer.unref();
  }

  private async ensureEventStream(baseUrl: string, applicationKey: string, bridgeId: string, generation: number): Promise<void> {
    if (this.stopped || generation !== this.configurationGeneration || this.streamRequest) return;
    const url = new URL(`${baseUrl}/eventstream/clip/v2`);
    const tlsOptions = await hueHttpsRequestOptions(url.toString(), { bridgeId });
    if (this.stopped || generation !== this.configurationGeneration || this.streamRequest) return;
    let buffer = "";
    const request = https.request(url, {
      ...tlsOptions,
      method: "GET",
      headers: { Accept: "text/event-stream", "hue-application-key": applicationKey }
    }, response => {
      if (response.statusCode !== 200) {
        request.destroy();
        this.status = { ...this.status, realtimeConnected: false, realtimeLastError: `HUE_HTTP_${response.statusCode ?? "ERROR"}` };
        this.streamRequest = undefined;
        this.scheduleReconnect(baseUrl, applicationKey, bridgeId, generation);
        return;
      }
      this.reconnectAttempt = 0;
      this.status = { ...this.status, realtimeConnected: true, realtimeLastError: undefined };
      response.setEncoding("utf8");
      response.on("data", chunk => {
        buffer += chunk.replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = frame.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
          if (data) {
            try {
              JSON.parse(data);
              this.status = { ...this.status, realtimeLastEvent: now(), realtimeLastError: undefined };
              this.scheduleReconcileFromEvent();
            } catch {
              this.status = { ...this.status, realtimeLastError: "HUE_EVENT_INVALID" };
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      });
      response.on("end", () => {
        if (this.streamRequest === request) this.streamRequest = undefined;
        this.status = { ...this.status, realtimeConnected: false };
        this.scheduleReconnect(baseUrl, applicationKey, bridgeId, generation);
      });
    });
    request.on("error", error => {
      if (this.streamRequest === request) this.streamRequest = undefined;
      if (this.stopped || generation !== this.configurationGeneration) return;
      this.status = { ...this.status, realtimeConnected: false, realtimeLastError: error.message || "HUE_EVENTSTREAM_FAILED" };
      this.scheduleReconnect(baseUrl, applicationKey, bridgeId, generation);
    });
    this.streamRequest = request;
    request.end();
  }

  async command(command: DeviceCommand): Promise<Device> {
    const device = this.registry.get(command.deviceId);
    if (!device || device.source !== "hue") throw new Error("DEVICE_NOT_FOUND");
    if (!device.capabilities.includes(command.capability)) throw new Error("CAPABILITY_NOT_SUPPORTED");
    const [kind, resourceId] = device.sourceId.split(":", 2);
    if (kind !== "light" || !resourceId) throw new Error("CAPABILITY_NOT_SUPPORTED");
    const connection = await getHueConnection();
    if (!connection.baseUrl || !connection.applicationKey) throw new Error("HUE_NOT_CONFIGURED");
    const baseUrl = normalizeHueBaseUrl(connection.baseUrl);
    const bridge = this.status.bridgeId ? { bridgeId: this.status.bridgeId } : await this.discoverBridge(baseUrl);
    if (!bridge.bridgeId) throw new Error("HUE_INVALID_RESPONSE");
    const body: Record<string, unknown> = {};
    if (command.capability === "toggle") body.on = { on: !Boolean(device.state.on) };
    else if (command.capability === "turnOn" || command.capability === "turnOff") body.on = { on: command.capability === "turnOn" };
    else if (command.capability === "setBrightness") {
      const brightness = Number(command.value);
      if (!Number.isFinite(brightness) || brightness < 0 || brightness > 100) throw new Error("INVALID_BRIGHTNESS");
      body.on = { on: true };
      body.dimming = { brightness };
    } else if (command.capability === "setColorTemperature") {
      const kelvin = Number(command.value);
      if (!Number.isFinite(kelvin) || kelvin < 1_500 || kelvin > 10_000) throw new Error("INVALID_COLOR_TEMPERATURE");
      const mirek = Math.round(1_000_000 / kelvin);
      const minMirek = Number(device.adapterData?.colorTemperatureMinMirek);
      const maxMirek = Number(device.adapterData?.colorTemperatureMaxMirek);
      if (Number.isFinite(minMirek) && mirek < minMirek) throw new Error("INVALID_COLOR_TEMPERATURE");
      if (Number.isFinite(maxMirek) && mirek > maxMirek) throw new Error("INVALID_COLOR_TEMPERATURE");
      body.on = { on: true };
      body.color_temperature = { mirek };
    } else if (command.capability === "setColor") {
      if (typeof command.value !== "string") throw new Error("INVALID_COLOR");
      body.on = { on: true };
      body.color = { xy: hexToHueXy(command.value) };
    } else throw new Error("CAPABILITY_NOT_SUPPORTED");
    await hueRequestJson(`${baseUrl}/clip/v2/resource/light/${encodeURIComponent(resourceId)}`, {
      method: "PUT",
      applicationKey: connection.applicationKey,
      bridgeId: bridge.bridgeId,
      body
    });
    if (this.reconcileTask) await this.reconcileTask.catch(() => undefined);
    await this.reconcile();
    return this.registry.get(command.deviceId) ?? device;
  }
}
