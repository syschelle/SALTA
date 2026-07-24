import {
  clearOpenCcuSettings,
  getOpenCcuConnection,
  updateOpenCcuSettings
} from "./db.js";
import {
  interfaceNames,
  normalizeOpenCcuBaseUrl,
  openCcuCatalogFromDescriptions,
  openCcuDeviceFromChannel,
  openCcuRpcEndpoint,
  record,
  stringifyRpcParams,
  unwrapRpcResult,
  type JsonRecord,
  type OpenCcuCatalogEntry
} from "./openccu-core.js";
import type { Device, DeviceCommand, OpenCcuGatewayStatus } from "./types.js";
import type { DeviceRegistry } from "./registry.js";

const pollIntervalMs = 60_000;
const requestTimeoutMs = 15_000;
const catalogRefreshMs = 15 * 60_000;
const supportedInterfaces = new Set(["BidCos-RF", "BidCos-Wired", "HmIP-RF", "VirtualDevices"]);
const now = (): string => new Date().toISOString();

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "OPENCCU_REQUEST_FAILED";
}

function mapNetworkError(error: unknown): Error {
  if (error instanceof Error && error.name === "AbortError") return new Error("OPENCCU_TIMEOUT");
  const cause = record(error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined);
  const code = String(cause.code ?? "");
  if (["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "CERT_HAS_EXPIRED"].includes(code)) {
    return new Error("OPENCCU_TLS_ERROR");
  }
  if (["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT"].includes(code)) {
    return new Error("OPENCCU_UNREACHABLE");
  }
  return error instanceof Error && error.message.startsWith("OPENCCU_") ? error : new Error("OPENCCU_REQUEST_FAILED");
}

class OpenCcuJsonRpcClient {
  private sessionId?: string;
  private requestId = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string
  ) {}

  private async post(method: string, params: JsonRecord): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(openCcuRpcEndpoint(this.baseUrl), {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ method, params: stringifyRpcParams(params), jsonrpc: "1.1", id: ++this.requestId }),
        signal: controller.signal
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error("OPENCCU_AUTHENTICATION_FAILED");
        throw new Error(`OPENCCU_HTTP_${response.status}`);
      }
      const text = await response.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error("OPENCCU_INVALID_RESPONSE");
      }
      return unwrapRpcResult(payload);
    } catch (error) {
      throw mapNetworkError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  async login(): Promise<void> {
    if (this.sessionId) return;
    if (!this.username.trim() || !this.password) throw new Error("OPENCCU_CREDENTIALS_REQUIRED");
    let result: unknown;
    try {
      result = await this.post("Session.login", { username: this.username, password: this.password });
    } catch (error) {
      const message = errorCode(error).toLowerCase();
      if (message.includes("login") || message.includes("auth") || message.includes("password") || message.includes("user") || message.includes("access denied") || message.includes("denied")) {
        throw new Error("OPENCCU_AUTHENTICATION_FAILED");
      }
      throw error;
    }
    if (typeof result !== "string" || !result.trim()) throw new Error("OPENCCU_AUTHENTICATION_FAILED");
    this.sessionId = result.trim();
  }

  async call(method: string, params: JsonRecord = {}): Promise<unknown> {
    await this.login();
    if (!this.sessionId) throw new Error("OPENCCU_AUTHENTICATION_FAILED");
    try {
      return await this.post(method, { _session_id_: this.sessionId, ...params });
    } catch (error) {
      if (errorCode(error).toLowerCase().includes("invalid session")) this.sessionId = undefined;
      throw error;
    }
  }

  async close(): Promise<void> {
    const sessionId = this.sessionId;
    this.sessionId = undefined;
    if (!sessionId) return;
    try {
      await this.post("Session.logout", { _session_id_: sessionId });
    } catch {
      // The CCU may already have discarded the session; cleanup must not hide the original result.
    }
  }
}

async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      if (item !== undefined) results[index] = await mapper(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export class OpenCcuAdapter {
  private timer?: ReturnType<typeof setInterval>;
  private reconcileTask?: Promise<void>;
  private configurationGeneration = 0;
  private catalog: OpenCcuCatalogEntry[] = [];
  private catalogLoadedAt = 0;
  private status: OpenCcuGatewayStatus = { connected: false, interfaces: [], devices: 0 };
  private commandQueues = new Map<string, Promise<void>>();

  constructor(private readonly registry: DeviceRegistry) {}

  start(): void {
    void this.reconcile().catch(() => undefined);
    this.timer = setInterval(() => void this.reconcile().catch(() => undefined), pollIntervalMs);
    (this.timer as { unref?: () => void }).unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  getStatus(): OpenCcuGatewayStatus {
    return { ...this.status, interfaces: [...this.status.interfaces] };
  }

  async configure(baseUrlInput: string, username: string, password?: string): Promise<OpenCcuGatewayStatus> {
    const baseUrl = normalizeOpenCcuBaseUrl(baseUrlInput);
    const existing = await getOpenCcuConnection();
    const effectivePassword = password ?? existing.password;
    if (!username.trim() || !effectivePassword) throw new Error("OPENCCU_CREDENTIALS_REQUIRED");
    const client = new OpenCcuJsonRpcClient(baseUrl, username.trim(), effectivePassword);
    try {
      const interfaces = interfaceNames(await client.call("Interface.listInterfaces"));
      await updateOpenCcuSettings(baseUrl, username.trim(), password);
      this.configurationGeneration += 1;
      this.catalog = [];
      this.catalogLoadedAt = 0;
      this.status = { connected: true, interfaces, devices: 0, lastSync: now() };
    } finally {
      await client.close();
    }
    if (this.reconcileTask) await this.reconcileTask.catch(() => undefined);
    await this.reconcile(true);
    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    this.configurationGeneration += 1;
    await clearOpenCcuSettings();
    if (this.reconcileTask) await this.reconcileTask.catch(() => undefined);
    await this.registry.removeSource("openccu");
    this.catalog = [];
    this.catalogLoadedAt = 0;
    this.status = { connected: false, interfaces: [], devices: 0 };
  }

  reconcile(forceCatalog = false): Promise<void> {
    if (this.reconcileTask) return this.reconcileTask;
    this.reconcileTask = this.performReconcile(forceCatalog).finally(() => { this.reconcileTask = undefined; });
    return this.reconcileTask;
  }

  private async refreshCatalog(client: OpenCcuJsonRpcClient, interfaces: string[]): Promise<void> {
    const details = await client.call("Device.listAllDetail");
    const descriptions = await mapWithConcurrency(interfaces, 2, async interfaceName => ({
      interfaceName,
      payload: await client.call("Interface.listDevices", { interface: interfaceName })
    }));
    this.catalog = descriptions.flatMap(item => openCcuCatalogFromDescriptions(item.interfaceName, item.payload, details));
    this.catalogLoadedAt = Date.now();
  }

  private async performReconcile(forceCatalog: boolean): Promise<void> {
    const generation = this.configurationGeneration;
    const connection = await getOpenCcuConnection();
    if (!connection.baseUrl || !connection.username || !connection.password) {
      this.status = { connected: false, interfaces: [], devices: 0 };
      return;
    }
    const client = new OpenCcuJsonRpcClient(connection.baseUrl, connection.username, connection.password);
    try {
      const allInterfaces = interfaceNames(await client.call("Interface.listInterfaces"));
      const interfaces = allInterfaces.filter(name => supportedInterfaces.has(name));
      if (forceCatalog || !this.catalog.length || Date.now() - this.catalogLoadedAt > catalogRefreshMs) {
        await this.refreshCatalog(client, interfaces);
      }
      const snapshots = await mapWithConcurrency(this.catalog, 3, async entry => {
        try {
          const values = record(await client.call("Interface.getParamset", {
            interface: entry.interfaceName,
            address: entry.channelAddress,
            paramsetKey: "VALUES"
          }));
          return openCcuDeviceFromChannel({ ...entry, baseUrl: connection.baseUrl, values });
        } catch {
          return undefined;
        }
      });
      if (generation !== this.configurationGeneration) return;
      const mapped = snapshots.filter((device): device is Device => Boolean(device));
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
          homekitEnabled: false,
          hidden: false,
          lastEvent: existing && JSON.stringify(existing.state) === JSON.stringify(discovered.state) ? existing.lastEvent : discovered.lastEvent
        });
      }
      for (const existing of this.registry.all().filter(device => device.source === "openccu" && !seen.has(device.id))) {
        if (generation !== this.configurationGeneration) return;
        await this.registry.set({ ...existing, reachable: false, lastSeen: now() });
      }
      this.status = {
        connected: true,
        interfaces,
        devices: mapped.length,
        lastSync: now()
      };
    } catch (error) {
      if (generation !== this.configurationGeneration) return;
      const message = errorCode(error);
      this.status = { ...this.status, connected: false, lastError: message, lastSync: now() };
      for (const existing of this.registry.all().filter(device => device.source === "openccu")) {
        await this.registry.set({ ...existing, reachable: false, lastSeen: now() });
      }
      throw error;
    } finally {
      await client.close();
    }
  }

  private async queueCommand(interfaceName: string, action: () => Promise<void>): Promise<void> {
    const previous = this.commandQueues.get(interfaceName) ?? Promise.resolve();
    const queued = previous.catch(() => undefined).then(async () => {
      await new Promise(resolve => setTimeout(resolve, 250));
      await action();
    });
    this.commandQueues.set(interfaceName, queued);
    try {
      await queued;
    } finally {
      if (this.commandQueues.get(interfaceName) === queued) this.commandQueues.delete(interfaceName);
    }
  }

  async command(command: DeviceCommand): Promise<Device> {
    const device = this.registry.get(command.deviceId);
    if (!device || device.source !== "openccu") throw new Error("DEVICE_NOT_FOUND");
    if (!device.capabilities.includes(command.capability)) throw new Error("CAPABILITY_NOT_SUPPORTED");
    const metadata = record(device.adapterData);
    const interfaceName = String(metadata.interfaceName ?? "");
    const channelAddress = String(metadata.channelAddress ?? "");
    if (!interfaceName || !channelAddress) throw new Error("OPENCCU_DEVICE_METADATA_MISSING");
    const connection = await getOpenCcuConnection();
    if (!connection.baseUrl || !connection.username || !connection.password) throw new Error("OPENCCU_NOT_CONFIGURED");

    let parameter = "";
    let valueType = "";
    let value: string | number | boolean;
    const nextState = { ...device.state };
    if (["turnOn", "turnOff", "toggle"].includes(command.capability)) {
      const on = command.capability === "toggle" ? !Boolean(device.state.on) : command.capability === "turnOn";
      if (metadata.stateParameter) {
        parameter = String(metadata.stateParameter);
        valueType = String(metadata.stateValueType ?? "boolean");
        value = on;
      } else if (metadata.levelParameter) {
        parameter = String(metadata.levelParameter);
        valueType = String(metadata.levelValueType ?? "double");
        value = on ? Math.max(0.01, Number(device.state.brightness ?? 100) / 100) : 0;
      } else throw new Error("CAPABILITY_NOT_SUPPORTED");
      nextState.on = on;
    } else if (command.capability === "setBrightness") {
      const brightness = Number(command.value);
      if (!Number.isFinite(brightness) || brightness < 0 || brightness > 100) throw new Error("INVALID_BRIGHTNESS");
      parameter = String(metadata.levelParameter ?? "");
      valueType = String(metadata.levelValueType ?? "double");
      value = brightness / 100;
      nextState.brightness = Math.round(brightness);
      nextState.on = brightness > 0;
    } else if (["open", "close", "setTargetPosition"].includes(command.capability)) {
      const position = command.capability === "open" ? 100 : command.capability === "close" ? 0 : Number(command.value);
      if (!Number.isFinite(position) || position < 0 || position > 100) throw new Error("INVALID_POSITION");
      parameter = String(metadata.levelParameter ?? "");
      valueType = String(metadata.levelValueType ?? "double");
      value = position / 100;
      nextState.targetPosition = Math.round(position);
    } else if (command.capability === "stop") {
      parameter = String(metadata.stopParameter ?? "");
      valueType = String(metadata.stopValueType ?? "boolean");
      value = true;
    } else throw new Error("CAPABILITY_NOT_SUPPORTED");
    if (!parameter) throw new Error("CAPABILITY_NOT_SUPPORTED");

    await this.queueCommand(interfaceName, async () => {
      const client = new OpenCcuJsonRpcClient(connection.baseUrl, connection.username, connection.password);
      try {
        await client.call("Interface.setValue", {
          interface: interfaceName,
          address: channelAddress,
          valueKey: parameter,
          type: valueType,
          value
        });
      } finally {
        await client.close();
      }
    });
    const updated = { ...device, state: nextState, lastEvent: now(), lastSeen: now(), reachable: true };
    await this.registry.set(updated);
    return updated;
  }
}
