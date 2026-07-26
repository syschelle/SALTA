import {
  clearOpenCcuSettings,
  getOpenCcuConnection,
  updateOpenCcuSettings,
  writeSystemLog
} from "./db.js";
import {
  interfaceNames,
  normalizeOpenCcuBaseUrl,
  openCcuCatalogFromDescriptions,
  openCcuDeviceFromChannel,
  openCcuDeviceIds,
  openCcuObjectName,
  openCcuRpcEndpoint,
  reconciledOpenCcuName,
  record,
  stringValue,
  stringifyRpcParams,
  unwrapRpcResult,
  type JsonRecord,
  type OpenCcuCatalogEntry
} from "./openccu-core.js";
import type {
  Device,
  DeviceCommand,
  OpenCcuDiagnosticReport,
  OpenCcuDiagnosticStep,
  OpenCcuGatewayStatus,
  SystemLogLevel
} from "./types.js";
import type { DeviceRegistry } from "./registry.js";

const pollIntervalMs = 60_000;
const reconnectIntervalMs = 15_000;
const sessionRetryDelayMs = 60_000;
const requestTimeoutMs = 15_000;
const catalogRefreshMs = 15 * 60_000;
const supportedInterfaces = new Set(["BidCos-RF", "BidCos-Wired", "HmIP-RF", "VirtualDevices"]);
const now = (): string => new Date().toISOString();

type ReconcileReason = "scheduled" | "manual" | "configuration";
type CallObserver = (step: OpenCcuDiagnosticStep) => void;

export interface OpenCcuErrorInfo {
  code: string;
  method?: string;
  remoteCode?: string;
  message?: string;
}

class OpenCcuAdapterError extends Error {
  constructor(
    readonly code: string,
    readonly method?: string,
    readonly remoteCode?: string,
    readonly remoteMessage?: string
  ) {
    super(code);
    this.name = "OpenCcuAdapterError";
  }
}

function legacyErrorInfo(error: Error): OpenCcuErrorInfo {
  const raw = error.message;
  if (raw.startsWith("OPENCCU_API_ERROR:")) {
    const [, remoteCode = "", ...messageParts] = raw.split(":");
    return {
      code: "OPENCCU_API_ERROR",
      remoteCode,
      message: messageParts.join(":") || "OpenCCU returned a JSON-RPC error."
    };
  }
  return { code: raw || "OPENCCU_REQUEST_FAILED" };
}

export function openCcuErrorInfo(error: unknown): OpenCcuErrorInfo {
  if (error instanceof OpenCcuAdapterError) {
    return {
      code: error.code,
      method: error.method,
      remoteCode: error.remoteCode,
      message: error.remoteMessage
    };
  }
  return error instanceof Error ? legacyErrorInfo(error) : { code: "OPENCCU_REQUEST_FAILED" };
}

function sessionInvalidError(info: OpenCcuErrorInfo): boolean {
  const message = `${info.message ?? ""} ${info.remoteCode ?? ""}`.toLowerCase();
  return /(invalid|unknown|expired|missing) session|session (?:is )?(?:invalid|unknown|expired|missing)|not (?:logged|signed) in/.test(message);
}

function mappedError(error: unknown, method: string): OpenCcuAdapterError {
  if (error instanceof OpenCcuAdapterError) return error;
  if (error instanceof Error && error.name === "AbortError") return new OpenCcuAdapterError("OPENCCU_TIMEOUT", method);
  const cause = record(error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined);
  const causeCode = String(cause.code ?? "");
  if (["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "CERT_HAS_EXPIRED"].includes(causeCode)) {
    return new OpenCcuAdapterError("OPENCCU_TLS_ERROR", method, causeCode);
  }
  if (["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT"].includes(causeCode)) {
    return new OpenCcuAdapterError("OPENCCU_UNREACHABLE", method, causeCode);
  }
  if (error instanceof Error) {
    const info = legacyErrorInfo(error);
    return new OpenCcuAdapterError(info.code, method, info.remoteCode, info.message);
  }
  return new OpenCcuAdapterError("OPENCCU_REQUEST_FAILED", method);
}

class OpenCcuJsonRpcClient {
  private sessionId?: string;
  private loginTask?: Promise<void>;
  private requestId = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string,
    private readonly observer?: CallObserver
  ) {}

  private async post(method: string, params: JsonRecord, interfaceName?: string, observe = true): Promise<unknown> {
    const started = Date.now();
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
        if (response.status === 401 || response.status === 403) throw new OpenCcuAdapterError("OPENCCU_AUTHENTICATION_FAILED", method, String(response.status));
        throw new OpenCcuAdapterError(`OPENCCU_HTTP_${response.status}`, method, String(response.status));
      }
      const text = await response.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new OpenCcuAdapterError("OPENCCU_INVALID_RESPONSE", method);
      }
      const result = unwrapRpcResult(payload);
      if (observe) this.observer?.({
        method,
        status: "ok",
        durationMs: Date.now() - started,
        interfaceName,
        resultCount: Array.isArray(result) ? result.length : undefined
      });
      return result;
    } catch (error) {
      const mapped = mappedError(error, method);
      const info = openCcuErrorInfo(mapped);
      if (observe) this.observer?.({
        method,
        status: "error",
        durationMs: Date.now() - started,
        interfaceName,
        code: info.code,
        remoteCode: info.remoteCode,
        message: info.message ?? info.remoteCode
      });
      throw mapped;
    } finally {
      clearTimeout(timeout);
    }
  }

  async login(): Promise<void> {
    if (this.sessionId) return;
    if (this.loginTask) return this.loginTask;
    if (!this.username.trim() || !this.password) throw new OpenCcuAdapterError("OPENCCU_CREDENTIALS_REQUIRED", "Session.login");

    const task = (async () => {
      let result: unknown;
      try {
        result = await this.post("Session.login", { username: this.username, password: this.password });
      } catch (error) {
        const info = openCcuErrorInfo(error);
        const message = `${info.message ?? ""} ${info.remoteCode ?? ""}`.toLowerCase();
        if (info.remoteCode === "501" && message.includes("too many sessions")) {
          throw new OpenCcuAdapterError("OPENCCU_AUTH_OR_SESSION_LIMIT", "Session.login", info.remoteCode, info.message);
        }
        if (info.code === "OPENCCU_AUTHENTICATION_FAILED" || /(login|auth|password|user|access denied|denied|invalid credentials)/.test(message)) {
          throw new OpenCcuAdapterError("OPENCCU_AUTHENTICATION_FAILED", "Session.login", info.remoteCode, info.message);
        }
        throw error;
      }
      const sessionId = typeof result === "string"
        ? result.trim()
        : stringValue(record(result)._session_id_ ?? record(result).session_id);
      if (!sessionId) throw new OpenCcuAdapterError("OPENCCU_AUTHENTICATION_FAILED", "Session.login");
      this.sessionId = sessionId;
    })().finally(() => {
      if (this.loginTask === task) this.loginTask = undefined;
    });
    this.loginTask = task;
    return task;
  }

  invalidateSession(): void {
    this.sessionId = undefined;
  }

  async call(method: string, params: JsonRecord = {}, interfaceName?: string): Promise<unknown> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.login();
      if (!this.sessionId) throw new OpenCcuAdapterError("OPENCCU_AUTHENTICATION_FAILED", "Session.login");
      try {
        return await this.post(method, { _session_id_: this.sessionId, ...params }, interfaceName);
      } catch (error) {
        const info = openCcuErrorInfo(error);
        if (sessionInvalidError(info) && attempt === 0) {
          this.invalidateSession();
          continue;
        }
        throw error;
      }
    }
    throw new OpenCcuAdapterError("OPENCCU_REQUEST_FAILED", method);
  }

  async close(observe = false): Promise<boolean> {
    await this.loginTask?.catch(() => undefined);
    const sessionId = this.sessionId;
    this.sessionId = undefined;
    if (!sessionId) return true;
    try {
      await this.post("Session.logout", { _session_id_: sessionId }, undefined, observe);
      return true;
    } catch {
      return false;
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

function stepError(step: OpenCcuDiagnosticStep): OpenCcuAdapterError {
  return new OpenCcuAdapterError(step.code ?? "OPENCCU_REQUEST_FAILED", step.method, step.remoteCode, step.message);
}

export class OpenCcuAdapter {
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private reconcileTask?: Promise<void>;
  private operationQueue: Promise<void> = Promise.resolve();
  private runtimeClient?: OpenCcuJsonRpcClient;
  private runtimeConnectionSignature = "";
  private sessionRetryAfter = 0;
  private configurationGeneration = 0;
  private catalog: OpenCcuCatalogEntry[] = [];
  private catalogLoadedAt = 0;
  private status: OpenCcuGatewayStatus = { connected: false, interfaces: [], devices: 0 };
  private commandQueues = new Map<string, Promise<void>>();
  private lastLoggedError = "";

  constructor(private readonly registry: DeviceRegistry) {}

  private log(level: SystemLogLevel, code: string | undefined, message: string, details: Record<string, unknown> = {}): void {
    void writeSystemLog(level, "openccu", code, message, details).catch(() => undefined);
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.operationQueue.catch(() => undefined).then(operation);
    this.operationQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  private connectionSignature(baseUrl: string, username: string, password: string): string {
    return `${baseUrl}\u0000${username}\u0000${password}`;
  }

  private async closeRuntimeClient(): Promise<void> {
    const client = this.runtimeClient;
    this.runtimeClient = undefined;
    this.runtimeConnectionSignature = "";
    if (!client) return;
    const closed = await client.close();
    if (!closed) this.log("warning", "OPENCCU_LOGOUT_FAILED", "OpenCCU runtime session could not be logged out cleanly");
  }

  private async getRuntimeClient(baseUrl: string, username: string, password: string): Promise<OpenCcuJsonRpcClient> {
    const signature = this.connectionSignature(baseUrl, username, password);
    if (!this.runtimeClient || this.runtimeConnectionSignature !== signature) {
      await this.closeRuntimeClient();
      this.runtimeClient = new OpenCcuJsonRpcClient(baseUrl, username, password);
      this.runtimeConnectionSignature = signature;
    }
    return this.runtimeClient;
  }

  private scheduleReconcile(delayMs: number): void {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      this.timer = undefined;
      try {
        await this.reconcile(false, "scheduled");
      } catch {
        // The adapter status and system log already contain the failure details.
      } finally {
        if (this.running) this.scheduleReconcile(this.status.connected ? pollIntervalMs : reconnectIntervalMs);
      }
    }, delayMs);
    (this.timer as { unref?: () => void }).unref?.();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleReconcile(0);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    await this.reconcileTask?.catch(() => undefined);
    await this.operationQueue.catch(() => undefined);
    await this.closeRuntimeClient();
  }

  getStatus(): OpenCcuGatewayStatus {
    return {
      ...this.status,
      interfaces: [...this.status.interfaces],
      lastDiagnostic: this.status.lastDiagnostic
        ? { ...this.status.lastDiagnostic, interfaces: [...this.status.lastDiagnostic.interfaces], steps: this.status.lastDiagnostic.steps.map(step => ({ ...step })) }
        : undefined
    };
  }

  private async runDiagnostics(baseUrl: string, username: string, password: string): Promise<OpenCcuDiagnosticReport> {
    const startedAt = now();
    const steps: OpenCcuDiagnosticStep[] = [];
    const client = new OpenCcuJsonRpcClient(baseUrl, username, password, step => steps.push(step));
    let interfaces: string[] = [];
    try {
      const allInterfaces = interfaceNames(await client.call("Interface.listInterfaces"));
      interfaces = allInterfaces.filter(name => supportedInterfaces.has(name));

      try {
        await client.call("Device.listAllDetail");
      } catch {
        const step = [...steps].reverse().find(item => item.method === "Device.listAllDetail" && item.status === "error");
        if (step) step.status = "warning";
      }

      for (const interfaceName of interfaces) {
        try {
          await client.call("Interface.listDevices", { interface: interfaceName }, interfaceName);
        } catch {
          const step = [...steps].reverse().find(item => item.method === "Interface.listDevices" && item.interfaceName === interfaceName && item.status === "error");
          if (step) step.status = "warning";
        }
      }
    } catch {
      // The failing method is already represented in the diagnostic steps.
    } finally {
      const closed = await client.close(true);
      if (!closed) {
        const logoutStep = [...steps].reverse().find(item => item.method === "Session.logout" && item.status === "error");
        if (logoutStep) logoutStep.status = "warning";
      }
    }

    for (const step of steps) {
      if (step.method === "Session.login" && step.remoteCode === "501" && (step.message ?? "").toLowerCase().includes("too many sessions")) {
        step.code = "OPENCCU_AUTH_OR_SESSION_LIMIT";
      }
    }

    const report: OpenCcuDiagnosticReport = {
      ok: !steps.some(step => step.status === "error"),
      startedAt,
      completedAt: now(),
      baseUrl,
      interfaces,
      steps
    };
    for (const step of report.steps) {
      const level: SystemLogLevel = step.status === "ok" ? "info" : step.status === "warning" ? "warning" : "error";
      this.log(level, step.code, `OpenCCU diagnostic: ${step.method} ${step.status}`, {
        method: step.method,
        interfaceName: step.interfaceName,
        durationMs: step.durationMs,
        resultCount: step.resultCount,
        remoteCode: step.remoteCode,
        remoteMessage: step.message
      });
    }
    this.status = { ...this.status, lastDiagnostic: report };
    return report;
  }

  async diagnose(baseUrlInput?: string, usernameInput?: string, passwordInput?: string): Promise<OpenCcuDiagnosticReport> {
    return this.runExclusive(async () => {
      const existing = await getOpenCcuConnection();
      const baseUrl = normalizeOpenCcuBaseUrl(baseUrlInput ?? existing.baseUrl);
      const username = (usernameInput ?? existing.username).trim();
      const password = passwordInput ?? existing.password;
      if (!username || !password) throw new OpenCcuAdapterError("OPENCCU_CREDENTIALS_REQUIRED", "Session.login");
      this.log("info", "OPENCCU_DIAGNOSTIC_STARTED", "OpenCCU diagnostic started", { baseUrl });
      await this.closeRuntimeClient();
      const report = await this.runDiagnostics(baseUrl, username, password);
      const firstError = report.steps.find(step => step.status === "error");
      if (firstError?.code === "OPENCCU_AUTH_OR_SESSION_LIMIT") this.sessionRetryAfter = Date.now() + sessionRetryDelayMs;
      else if (report.ok) this.sessionRetryAfter = 0;
      this.status = {
        ...this.status,
        connected: report.ok,
        interfaces: report.interfaces,
        lastDiagnostic: report,
        lastError: firstError?.code,
        lastErrorMethod: firstError?.method,
        lastErrorRemoteCode: firstError?.remoteCode,
        lastErrorMessage: firstError?.message,
        lastSync: now()
      };
      this.log(report.ok ? "info" : "error", report.ok ? "OPENCCU_DIAGNOSTIC_OK" : firstError?.code, report.ok ? "OpenCCU diagnostic completed" : "OpenCCU diagnostic found a blocking error", {
        interfaces: report.interfaces,
        steps: report.steps.length,
        failedMethod: firstError?.method,
        remoteCode: firstError?.remoteCode,
        remoteMessage: firstError?.message
      });
      return report;
    });
  }

  async configure(baseUrlInput: string, username: string, password?: string): Promise<OpenCcuGatewayStatus> {
    return this.runExclusive(async () => {
      const baseUrl = normalizeOpenCcuBaseUrl(baseUrlInput);
      const existing = await getOpenCcuConnection();
      const effectivePassword = password ?? existing.password;
      const normalizedUsername = username.trim();
      if (!normalizedUsername || !effectivePassword) throw new OpenCcuAdapterError("OPENCCU_CREDENTIALS_REQUIRED", "Session.login");

      await this.closeRuntimeClient();
      const report = await this.runDiagnostics(baseUrl, normalizedUsername, effectivePassword);
      const loginStep = report.steps.find(step => step.method === "Session.login");
      const interfaceStep = report.steps.find(step => step.method === "Interface.listInterfaces");
      const fatalStep = [loginStep, interfaceStep].find(step => step?.status === "error");
      if (fatalStep) {
        if (fatalStep.code === "OPENCCU_AUTH_OR_SESSION_LIMIT") this.sessionRetryAfter = Date.now() + sessionRetryDelayMs;
        this.status = {
          connected: false,
          interfaces: report.interfaces,
          devices: this.status.devices,
          lastSync: now(),
          lastError: fatalStep.code,
          lastErrorMethod: fatalStep.method,
          lastErrorRemoteCode: fatalStep.remoteCode,
          lastErrorMessage: fatalStep.message,
          lastDiagnostic: report
        };
        throw stepError(fatalStep);
      }

      await updateOpenCcuSettings(baseUrl, normalizedUsername, password);
      this.configurationGeneration += 1;
      this.catalog = [];
      this.catalogLoadedAt = 0;
      this.sessionRetryAfter = 0;
      await this.closeRuntimeClient();
      this.status = { connected: true, interfaces: report.interfaces, devices: 0, lastSync: now(), lastDiagnostic: report };
      this.log("info", "OPENCCU_CONFIGURED", "OpenCCU connection saved after successful authentication", { baseUrl, interfaces: report.interfaces });

      await this.performReconcile(true, "configuration").catch(() => undefined);
      return this.getStatus();
    });
  }

  async disconnect(): Promise<void> {
    return this.runExclusive(async () => {
      this.configurationGeneration += 1;
      await clearOpenCcuSettings();
      await this.closeRuntimeClient();
      await this.registry.removeSource("openccu");
      this.catalog = [];
      this.catalogLoadedAt = 0;
      this.sessionRetryAfter = 0;
      this.status = { connected: false, interfaces: [], devices: 0 };
      this.log("info", "OPENCCU_DISCONNECTED", "OpenCCU connection removed");
    });
  }

  reconcile(forceCatalog = false, reason: ReconcileReason = "scheduled"): Promise<void> {
    if (reason === "scheduled" && Date.now() < this.sessionRetryAfter) return Promise.resolve();
    if (this.reconcileTask) return this.reconcileTask;
    this.reconcileTask = this.runExclusive(() => this.performReconcile(forceCatalog, reason))
      .finally(() => { this.reconcileTask = undefined; });
    return this.reconcileTask;
  }

  private async refreshCatalog(client: OpenCcuJsonRpcClient, interfaces: string[]): Promise<void> {
    let details: unknown = [];
    try {
      details = await client.call("Device.listAllDetail");
    } catch (error) {
      const info = openCcuErrorInfo(error);
      this.log("warning", info.code, "OpenCCU device names could not be loaded; synchronization continues without detailed names", {
        method: info.method,
        remoteMessage: info.message
      });
    }

    const descriptions = await mapWithConcurrency(interfaces, 2, async interfaceName => {
      try {
        return {
          interfaceName,
          payload: await client.call("Interface.listDevices", { interface: interfaceName }, interfaceName)
        };
      } catch (error) {
        const info = openCcuErrorInfo(error);
        this.log("warning", info.code, "OpenCCU interface could not be enumerated", {
          method: info.method,
          interfaceName,
          remoteMessage: info.message
        });
        return undefined;
      }
    });
    const successful = descriptions.filter((item): item is { interfaceName: string; payload: unknown } => Boolean(item));
    if (interfaces.length && !successful.length) throw new OpenCcuAdapterError("OPENCCU_CATALOG_UNAVAILABLE", "Interface.listDevices");

    let catalog = successful.flatMap(item => openCcuCatalogFromDescriptions(item.interfaceName, item.payload, details));

    // Device.get expects a ReGa object id, not a radio address. Ask ReGa for
    // its configured device ids first, then join each returned object's
    // physical address and name back to the RPC catalogue. This makes the
    // card title independent from the varying Device.listAllDetail shapes.
    const catalogDeviceAddresses = new Set(catalog.map(entry => entry.deviceAddress));
    const resolvedNames = new Map<string, string>();
    let nameFailures = 0;
    try {
      const deviceIds = openCcuDeviceIds(await client.call("Device.listAll"));
      await mapWithConcurrency(deviceIds, 4, async id => {
        try {
          const result = record(await client.call("Device.get", { id }));
          const address = stringValue(result.address ?? result.deviceAddress ?? result.device_address);
          const name = openCcuObjectName(result);
          if (address && name && catalogDeviceAddresses.has(address)) resolvedNames.set(address, name);
        } catch {
          nameFailures += 1;
        }
      });
    } catch {
      nameFailures = catalogDeviceAddresses.size;
    }
    catalog = catalog.map(entry => ({
      ...entry,
      deviceName: resolvedNames.get(entry.deviceAddress) ?? entry.deviceName
    }));

    // Cache the VALUES parameter schema during the catalogue refresh. It
    // identifies writable parameters and their native HomeMatic JSON-RPC type
    // (bool/float/int/string), preventing control requests with guessed types.
    let descriptionFailures = 0;
    catalog = await mapWithConcurrency(catalog, 4, async entry => {
      try {
        const paramsetDescription = record(await client.call("Interface.getParamsetDescription", {
          interface: entry.interfaceName,
          address: entry.channelAddress,
          paramsetKey: "VALUES"
        }, entry.interfaceName));
        return { ...entry, paramsetDescription };
      } catch {
        descriptionFailures += 1;
        return entry;
      }
    });

    if (nameFailures) {
      this.log("warning", "OPENCCU_DEVICE_NAME_PARTIAL", "Some OpenCCU device names could not be resolved", {
        failedDevices: nameFailures,
        catalogDevices: catalogDeviceAddresses.size
      });
    }
    if (descriptionFailures) {
      this.log("warning", "OPENCCU_PARAMSET_DESCRIPTION_PARTIAL", "Some OpenCCU control descriptions could not be loaded", {
        failedChannels: descriptionFailures,
        catalogChannels: catalog.length
      });
    }

    this.catalog = catalog;
    this.catalogLoadedAt = Date.now();
  }

  private async performReconcile(forceCatalog: boolean, reason: ReconcileReason): Promise<void> {
    const generation = this.configurationGeneration;
    const connection = await getOpenCcuConnection();
    if (!connection.baseUrl || !connection.username || !connection.password) {
      this.status = { connected: false, interfaces: [], devices: 0 };
      return;
    }
    const client = await this.getRuntimeClient(connection.baseUrl, connection.username, connection.password);
    try {
      const allInterfaces = interfaceNames(await client.call("Interface.listInterfaces"));
      const interfaces = allInterfaces.filter(name => supportedInterfaces.has(name));
      if (forceCatalog || !this.catalog.length || Date.now() - this.catalogLoadedAt > catalogRefreshMs) {
        await this.refreshCatalog(client, interfaces);
      }
      let snapshotFailures = 0;
      const snapshots = await mapWithConcurrency(this.catalog, 3, async entry => {
        try {
          const values = record(await client.call("Interface.getParamset", {
            interface: entry.interfaceName,
            address: entry.channelAddress,
            paramsetKey: "VALUES"
          }, entry.interfaceName));
          return openCcuDeviceFromChannel({ ...entry, baseUrl: connection.baseUrl, values });
        } catch {
          snapshotFailures += 1;
          return undefined;
        }
      });
      if (generation !== this.configurationGeneration) return;
      if (this.catalog.length > 0 && snapshotFailures === this.catalog.length) {
        throw new OpenCcuAdapterError("OPENCCU_CHANNELS_UNAVAILABLE", "Interface.getParamset");
      }
      const mapped = snapshots.filter((device): device is Device => Boolean(device));
      const seen = new Set(mapped.map(device => device.id));
      for (const discovered of mapped) {
        if (generation !== this.configurationGeneration) return;
        this.registry.restore(discovered.id);
        const existing = this.registry.get(discovered.id);
        await this.registry.set({
          ...discovered,
          name: reconciledOpenCcuName(existing, discovered),
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
      const wasDisconnected = !this.status.connected;
      this.status = {
        connected: true,
        interfaces,
        devices: mapped.length,
        lastSync: now(),
        lastDiagnostic: this.status.lastDiagnostic
      };
      if (snapshotFailures) {
        this.log("warning", "OPENCCU_CHANNEL_READ_PARTIAL", "Some OpenCCU channels could not be read", {
          failedChannels: snapshotFailures,
          catalogChannels: this.catalog.length
        });
      }
      if (reason !== "scheduled" || wasDisconnected) {
        this.log("info", "OPENCCU_SYNC_OK", "OpenCCU synchronization completed", {
          reason,
          interfaces,
          devices: mapped.length,
          failedChannels: snapshotFailures
        });
      }
      this.lastLoggedError = "";
      this.sessionRetryAfter = 0;
    } catch (error) {
      if (generation !== this.configurationGeneration) return;
      const info = openCcuErrorInfo(error);
      this.runtimeClient?.invalidateSession();
      this.catalogLoadedAt = 0;
      if (info.code === "OPENCCU_AUTH_OR_SESSION_LIMIT") this.sessionRetryAfter = Date.now() + sessionRetryDelayMs;
      this.status = {
        ...this.status,
        connected: false,
        lastError: info.code,
        lastErrorMethod: info.method,
        lastErrorRemoteCode: info.remoteCode,
        lastErrorMessage: info.message,
        lastSync: now()
      };
      for (const existing of this.registry.all().filter(device => device.source === "openccu")) {
        await this.registry.set({ ...existing, reachable: false, lastSeen: now() });
      }
      const signature = `${info.code}|${info.method ?? ""}|${info.message ?? ""}`;
      if (reason !== "scheduled" || signature !== this.lastLoggedError) {
        this.log("error", info.code, "OpenCCU synchronization failed", {
          reason,
          method: info.method,
          remoteCode: info.remoteCode,
          remoteMessage: info.message
        });
        this.lastLoggedError = signature;
      }
      throw error;
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
        valueType = String(metadata.stateValueType ?? "bool");
        value = on;
      } else if (metadata.levelParameter) {
        parameter = String(metadata.levelParameter);
        valueType = String(metadata.levelValueType ?? "float");
        value = on ? Math.max(0.01, Number(device.state.brightness ?? 100) / 100) : 0;
      } else throw new Error("CAPABILITY_NOT_SUPPORTED");
      nextState.on = on;
    } else if (command.capability === "setBrightness") {
      const brightness = Number(command.value);
      if (!Number.isFinite(brightness) || brightness < 0 || brightness > 100) throw new Error("INVALID_BRIGHTNESS");
      parameter = String(metadata.levelParameter ?? "");
      valueType = String(metadata.levelValueType ?? "float");
      value = brightness / 100;
      nextState.brightness = Math.round(brightness);
      nextState.on = brightness > 0;
    } else if (["open", "close", "setTargetPosition"].includes(command.capability)) {
      const position = command.capability === "open" ? 100 : command.capability === "close" ? 0 : Number(command.value);
      if (!Number.isFinite(position) || position < 0 || position > 100) throw new Error("INVALID_POSITION");
      parameter = String(metadata.levelParameter ?? "");
      valueType = String(metadata.levelValueType ?? "float");
      value = position / 100;
      nextState.targetPosition = Math.round(position);
    } else if (command.capability === "stop") {
      parameter = String(metadata.stopParameter ?? "");
      valueType = String(metadata.stopValueType ?? "bool");
      value = true;
    } else if (command.capability === "setTargetTemperature") {
      const temperature = Number(command.value);
      const minimum = Number(metadata.targetTemperatureMin ?? 5);
      const maximum = Number(metadata.targetTemperatureMax ?? 30);
      if (!Number.isFinite(temperature) || temperature < minimum || temperature > maximum) throw new Error("INVALID_TARGET_TEMPERATURE");
      parameter = String(metadata.targetTemperatureParameter ?? "");
      valueType = String(metadata.targetTemperatureValueType ?? "float");
      value = Math.round(temperature * 2) / 2;
      nextState.targetTemperature = value;
    } else throw new Error("CAPABILITY_NOT_SUPPORTED");
    if (!parameter) throw new Error("CAPABILITY_NOT_SUPPORTED");

    await this.queueCommand(interfaceName, () => this.runExclusive(async () => {
      const client = await this.getRuntimeClient(connection.baseUrl, connection.username, connection.password);
      try {
        await client.call("Interface.setValue", {
          interface: interfaceName,
          address: channelAddress,
          valueKey: parameter,
          type: valueType,
          value
        }, interfaceName);
        this.sessionRetryAfter = 0;
      } catch (error) {
        const info = openCcuErrorInfo(error);
        if (info.code === "OPENCCU_AUTH_OR_SESSION_LIMIT") this.sessionRetryAfter = Date.now() + sessionRetryDelayMs;
        throw error;
      }
    }));
    const updated = { ...device, state: nextState, lastEvent: now(), lastSeen: now(), reachable: true };
    await this.registry.set(updated);
    return updated;
  }
}
