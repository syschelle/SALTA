import { createHash, randomBytes } from "node:crypto";
import type { Device, DeviceCommand, ShellyComponentKind } from "./types.js";
import { DeviceRegistry } from "./registry.js";
import { getDeviceCredentials } from "./db.js";
import { detectGen1Shelly, detectRpcShellyComponents } from "./shelly-parser.js";

const now = () => new Date().toISOString();
const timeoutMs = 3500;

type JsonRecord = Record<string, unknown>;
type Generation = NonNullable<Device["generation"]>;
type ProbeResult = { host: string; generation: Generation; model: string; sourceId: string; name: string; device: Device };

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function basicAuthHeader(username: string, password: string): Record<string, string> {
  if (!username && !password) return {};
  return { authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };
}

type DigestChallenge = {
  realm: string;
  nonce: string;
  algorithm: string;
  qop?: string;
  opaque?: string;
};

function parseDigestChallenge(value: string | null): DigestChallenge | undefined {
  if (!value?.toLowerCase().startsWith("digest ")) return undefined;
  const attributes: Record<string, string> = {};
  const input = value.slice(7);
  const pattern = /([a-zA-Z0-9_-]+)\s*=\s*(?:"((?:\\.|[^"])*)"|([^,\s]+))/g;
  for (const match of input.matchAll(pattern)) {
    const key = match[1]?.toLowerCase();
    const raw = match[2] ?? match[3];
    if (key && raw !== undefined) attributes[key] = raw.replace(/\\"/g, '"');
  }
  if (!attributes.realm || !attributes.nonce) return undefined;
  return {
    realm: attributes.realm,
    nonce: attributes.nonce,
    algorithm: attributes.algorithm ?? "MD5",
    qop: attributes.qop,
    opaque: attributes.opaque
  };
}

function digestHash(algorithm: string, value: string): string {
  const normalized = algorithm.toUpperCase().replace(/-SESS$/, "");
  const nodeAlgorithm = normalized === "SHA-256" ? "sha256" : normalized === "MD5" ? "md5" : undefined;
  if (!nodeAlgorithm) throw new Error("AUTHENTICATION_FAILED");
  return createHash(nodeAlgorithm).update(value).digest("hex");
}

function quoteDigest(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function digestAuthHeader(challenge: DigestChallenge, username: string, password: string, method: string, url: string): string {
  const parsedUrl = new URL(url);
  const uri = `${parsedUrl.pathname}${parsedUrl.search}`;
  const cnonce = randomBytes(16).toString("hex");
  const nonceCount = "00000001";
  const offeredQop = challenge.qop?.split(",").map(value => value.trim().toLowerCase());
  const qop = offeredQop?.includes("auth") ? "auth" : undefined;
  let ha1 = digestHash(challenge.algorithm, `${username}:${challenge.realm}:${password}`);
  if (challenge.algorithm.toUpperCase().endsWith("-SESS")) {
    ha1 = digestHash(challenge.algorithm, `${ha1}:${challenge.nonce}:${cnonce}`);
  }
  const ha2 = digestHash(challenge.algorithm, `${method}:${uri}`);
  const response = qop
    ? digestHash(challenge.algorithm, `${ha1}:${challenge.nonce}:${nonceCount}:${cnonce}:${qop}:${ha2}`)
    : digestHash(challenge.algorithm, `${ha1}:${challenge.nonce}:${ha2}`);
  const fields = [
    `username="${quoteDigest(username)}"`,
    `realm="${quoteDigest(challenge.realm)}"`,
    `nonce="${quoteDigest(challenge.nonce)}"`,
    `uri="${quoteDigest(uri)}"`,
    `response="${response}"`,
    `algorithm=${challenge.algorithm}`
  ];
  if (challenge.opaque) fields.push(`opaque="${quoteDigest(challenge.opaque)}"`);
  if (qop) fields.push(`qop=${qop}`, `nc=${nonceCount}`, `cnonce="${cnonce}"`);
  return `Digest ${fields.join(", ")}`;
}

async function requestJson(url: string, username = "", password = "", method = "GET", body?: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const requestBody = body === undefined ? undefined : JSON.stringify(body);
  const baseHeaders: Record<string, string> = { accept: "application/json" };
  if (requestBody !== undefined) baseHeaders["content-type"] = "application/json";
  const execute = (authorization?: string): Promise<Response> => fetch(url, {
    method,
    headers: { ...baseHeaders, ...(authorization ? { authorization } : {}) },
    body: requestBody,
    signal: controller.signal
  });
  try {
    let response = await execute(username || password ? basicAuthHeader(username, password).authorization : undefined);
    if (response.status === 401 || response.status === 403) {
      const challenge = parseDigestChallenge(response.headers.get("www-authenticate"));
      if (challenge && (username || password)) {
        const digestUsername = username || "admin";
        response = await execute(digestAuthHeader(challenge, digestUsername, password, method, url));
      }
    }
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "AUTHENTICATION_FAILED" : `HTTP_${response.status}`);
    try {
      return await response.json() as unknown;
    } catch {
      throw new Error("INVALID_DEVICE_RESPONSE");
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("DETECTION_TIMEOUT");
    if (error instanceof TypeError) throw new Error("DEVICE_UNREACHABLE");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function rpcResult(value: unknown): unknown {
  const frame = record(value);
  const error = record(frame.error);
  const code = Number(error.code);
  if (code === 401) throw new Error("AUTHENTICATION_FAILED");
  if (Number.isFinite(code)) throw new Error("INVALID_DEVICE_RESPONSE");
  return frame.result ?? frame.params ?? value;
}

async function requestRpcMethod(host: string, method: string, username = "", password = ""): Promise<unknown> {
  const endpoint = `http://${host}/rpc/${method}`;
  try {
    return await requestJson(endpoint, username, password, "GET");
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (!["HTTP_400", "HTTP_404", "HTTP_405"].includes(code)) throw error;
    const frame = await requestJson(`http://${host}/rpc`, username, password, "POST", { id: 1, method });
    return rpcResult(frame);
  }
}

function idFor(host: string, sourceId: string): string {
  return `shelly:${createHash("sha1").update(`${host}:${sourceId}`).digest("hex").slice(0, 20)}`;
}


function rpcProfile(info: JsonRecord, config: JsonRecord): string | undefined {
  return stringValue(info.profile)?.toLowerCase()
    ?? stringValue(config.profile)?.toLowerCase()
    ?? stringValue(record(config.sys).profile)?.toLowerCase()
    ?? stringValue(record(record(config.sys).device).profile)?.toLowerCase();
}

function componentConfiguredName(config: JsonRecord, kind: ShellyComponentKind | undefined, id: number | undefined): string | undefined {
  if (!kind || id === undefined) return undefined;
  return stringValue(record(config[`${kind}:${id}`]).name);
}

function systemConfiguredName(config: JsonRecord): string | undefined {
  return stringValue(record(record(config.sys).device).name);
}

function logicalSourceId(physicalSourceId: string, index: number, kind: ShellyComponentKind | undefined, id: number | undefined, total: number): string {
  if (total <= 1 || index === 0) return physicalSourceId;
  return `${physicalSourceId}:${kind ?? "component"}:${id ?? index}`;
}

function rpcGeneration(info: JsonRecord): Generation {
  const generation = Number(info.gen);
  if (generation === 2 || generation === 3 || generation === 4) return `gen${generation}`;
  return "rpc";
}

function rpcNamespace(kind: ShellyComponentKind | undefined): string {
  switch (kind) {
    case "cover": return "Cover";
    case "light": return "Light";
    case "rgb": return "RGB";
    case "rgbw": return "RGBW";
    case "cct": return "CCT";
    default: return "Switch";
  }
}

function statesEqual(a: Device["state"], b: Device["state"]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class ShellyAdapter {
  private timer?: NodeJS.Timeout;
  private reconcileTask?: Promise<void>;
  private readonly removedDeviceIds = new Set<string>();

  constructor(private registry: DeviceRegistry) {}

  start(): void {
    void this.reconcile();
    this.timer = setInterval(() => void this.reconcile(), 10_000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async probeAll(host: string, username = "", password = ""): Promise<ProbeResult[]> {
    const clean = host.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    let rpcInfo: JsonRecord | undefined;
    let rpcIdentityError: unknown;

    try {
      const identity = record(await requestJson(`http://${clean}/shelly`, username, password));
      const generation = Number(identity.gen);
      if (generation === 2 || generation === 3 || generation === 4) rpcInfo = identity;
    } catch (error) {
      if (error instanceof Error && error.message === "AUTHENTICATION_FAILED") throw error;
      rpcIdentityError = error;
    }

    if (!rpcInfo) {
      try {
        const identity = record(await requestRpcMethod(clean, "Shelly.GetDeviceInfo", username, password));
        const generation = Number(identity.gen);
        if (generation === 2 || generation === 3 || generation === 4 || stringValue(identity.id)) rpcInfo = identity;
      } catch (error) {
        if (error instanceof Error && error.message === "AUTHENTICATION_FAILED") throw error;
        rpcIdentityError = error;
      }
    }

    if (rpcInfo) {
      const [rawStatus, rawConfig] = await Promise.all([
        requestRpcMethod(clean, "Shelly.GetStatus", username, password),
        requestRpcMethod(clean, "Shelly.GetConfig", username, password).catch(() => ({}))
      ]);
      const rpcConfig = record(rawConfig);
      const profile = rpcProfile(rpcInfo, rpcConfig);
      const infoWithProfile = profile ? { ...rpcInfo, profile } : rpcInfo;
      const detections = detectRpcShellyComponents(infoWithProfile, rawStatus);
      const physicalSourceId = stringValue(rpcInfo.id) ?? clean;
      const model = stringValue(rpcInfo.app) ?? stringValue(rpcInfo.model) ?? "Shelly RPC";
      const baseName = systemConfiguredName(rpcConfig) ?? stringValue(rpcInfo.name) ?? model ?? physicalSourceId;
      const timestamp = now();

      return detections.map((detection, index) => {
        const sourceId = logicalSourceId(physicalSourceId, index, detection.componentKind, detection.componentId, detections.length);
        const configuredName = componentConfiguredName(rpcConfig, detection.componentKind, detection.componentId);
        const name = configuredName ?? (detections.length > 1 ? `${baseName} ${index + 1}` : baseName);
        const device: Device = {
          id: idFor(clean, sourceId),
          source: "shelly",
          sourceId,
          type: detection.type,
          name,
          host: clean,
          generation: rpcGeneration(rpcInfo),
          model,
          firmwareVersion: stringValue(rpcInfo.ver) ?? stringValue(rpcInfo.fw_id),
          hostname: physicalSourceId,
          macAddress: stringValue(rpcInfo.mac),
          profile: detection.profile ?? profile,
          componentKind: detection.componentKind,
          componentId: detection.componentId,
          channelCount: detection.channelCount,
          powerMetering: detection.powerMetering,
          coverSupport: detection.coverSupport,
          switchSupport: detection.switchSupport,
          lightSupport: detection.lightSupport,
          inputSupport: detection.inputSupport,
          reachable: true,
          state: detection.state,
          capabilities: detection.capabilities,
          homekitEnabled: true,
          credentialMode: "inherit",
          passwordConfigured: false,
          lastSeen: timestamp,
          lastEvent: timestamp
        };
        return { host: clean, generation: device.generation ?? "rpc", model, sourceId, name, device };
      });
    }

    try {
      const [rawSettings, rawStatus] = await Promise.all([
        requestJson(`http://${clean}/settings`, username, password),
        requestJson(`http://${clean}/status`, username, password)
      ]);
      const settings = record(rawSettings);
      const deviceSettings = record(settings.device);
      const detection = detectGen1Shelly(settings, rawStatus);
      const sourceId = stringValue(deviceSettings.mac) ?? stringValue(deviceSettings.hostname) ?? clean;
      const model = stringValue(deviceSettings.type) ?? "Shelly Gen1";
      const name = stringValue(settings.name) ?? stringValue(deviceSettings.hostname) ?? sourceId;
      const timestamp = now();
      const device: Device = {
        id: idFor(clean, sourceId),
        source: "shelly",
        sourceId,
        type: detection.type,
        name,
        host: clean,
        generation: "gen1",
        model,
        firmwareVersion: stringValue(settings.fw),
        hostname: stringValue(deviceSettings.hostname),
        macAddress: stringValue(deviceSettings.mac),
        profile: detection.profile,
        componentKind: detection.componentKind,
        componentId: detection.componentId,
        channelCount: detection.channelCount,
        powerMetering: detection.powerMetering,
        coverSupport: detection.coverSupport,
        switchSupport: detection.switchSupport,
        lightSupport: detection.lightSupport,
        inputSupport: detection.inputSupport,
        reachable: true,
        state: detection.state,
        capabilities: detection.capabilities,
        homekitEnabled: true,
        credentialMode: "inherit",
        passwordConfigured: false,
        lastSeen: timestamp,
        lastEvent: timestamp
      };
      return [{ host: clean, generation: "gen1", model, sourceId, name, device }];
    } catch (gen1Error) {
      if (gen1Error instanceof Error && gen1Error.message === "AUTHENTICATION_FAILED") throw gen1Error;
      if (rpcIdentityError instanceof Error && rpcIdentityError.message !== "HTTP_404") throw rpcIdentityError;
      if (gen1Error instanceof Error) throw gen1Error;
      throw rpcIdentityError ?? new Error("UNSUPPORTED_SHELLY_DEVICE");
    }
  }

  async probe(host: string, username = "", password = ""): Promise<ProbeResult> {
    const result = (await this.probeAll(host, username, password))[0];
    if (!result) throw new Error("UNSUPPORTED_SHELLY_DEVICE");
    return result;
  }

  async add(host: string, username = "", password = "", name?: string, roomId?: string, room?: string, credentialMode: "inherit" | "custom" | "none" = "inherit"): Promise<Device[]> {
    const results = await this.probeAll(host, username, password);
    const baseName = name?.trim();
    const devices: Device[] = [];

    for (const [index, result] of results.entries()) {
      this.removedDeviceIds.delete(result.device.id);
      this.registry.restore(result.device.id);
      const existing = this.registry.get(result.device.id);
      const device: Device = {
        ...result.device,
        name: baseName ? (results.length > 1 ? `${baseName} ${index + 1}` : baseName) : existing?.name ?? result.device.name,
        roomId: roomId ?? existing?.roomId,
        room: room ?? existing?.room,
        homekitEnabled: existing?.homekitEnabled ?? result.device.homekitEnabled,
        credentialMode,
        credentialUsername: credentialMode === "custom" ? username : undefined,
        passwordConfigured: credentialMode === "custom" && Boolean(password)
      };
      await this.registry.set(device);
      if (credentialMode === "custom") await this.registry.patchCredentials(device.id, "custom", username, password);
      devices.push(device);
    }

    return devices;
  }

  async discover(prefix: string, username = "", password = ""): Promise<Omit<ProbeResult, "device">[]> {
    const match = prefix.trim().match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.(?:0\/24|\d{1,3})$/);
    if (!match) throw new Error("INVALID_SUBNET");
    const hosts = Array.from({ length: 254 }, (_, index) => `${match[1]}.${index + 1}`);
    const found: ProbeResult[] = [];
    let index = 0;
    const workers = Array.from({ length: 24 }, async () => {
      while (index < hosts.length) {
        const host = hosts[index++];
        if (!host) continue;
        try { found.push(await this.probe(host, username, password)); } catch { /* Ignore non-Shelly hosts. */ }
      }
    });
    await Promise.all(workers);
    return found.map(({ device: _device, ...item }) => item);
  }

  async refresh(device: Device): Promise<Device> {
    if (this.removedDeviceIds.has(device.id) || !device.host) return device;
    const credentials = await getDeviceCredentials(device.id);
    try {
      const candidates = await this.probeAll(device.host, credentials.username, credentials.password);
      const probed = candidates.find(candidate =>
        candidate.device.componentKind === device.componentKind && candidate.device.componentId === device.componentId
      ) ?? (device.componentId === undefined || device.componentId === 0 ? candidates[0] : undefined);
      if (!probed) throw new Error("DEVICE_COMPONENT_NOT_FOUND");
      const seenAt = now();
      const next: Device = {
        ...device,
        ...probed.device,
        id: device.id,
        name: device.name,
        roomId: device.roomId,
        room: device.room,
        homekitEnabled: device.homekitEnabled,
        credentialMode: device.credentialMode,
        credentialUsername: device.credentialUsername,
        passwordConfigured: device.passwordConfigured,
        lastSeen: seenAt,
        lastEvent: statesEqual(device.state, probed.device.state) ? device.lastEvent : seenAt
      };
      if (this.removedDeviceIds.has(device.id)) return device;
      await this.registry.set(next);
      return next;
    } catch {
      if (this.removedDeviceIds.has(device.id)) return device;
      const next = { ...device, reachable: false, lastSeen: now() };
      await this.registry.set(next);
      return next;
    }
  }

  async remove(deviceId: string): Promise<void> {
    const device = this.registry.get(deviceId);
    if (!device) throw new Error("DEVICE_NOT_FOUND");
    if (device.source !== "shelly") throw new Error("ADAPTER_NOT_SUPPORTED");
    this.removedDeviceIds.add(deviceId);
    try {
      const removed = await this.registry.remove(deviceId);
      if (!removed) throw new Error("DEVICE_NOT_FOUND");
    } catch (error) {
      this.removedDeviceIds.delete(deviceId);
      throw error;
    }
  }

  reconcile(): Promise<void> {
    if (this.reconcileTask) return this.reconcileTask;
    this.reconcileTask = Promise.allSettled(
      this.registry.all().filter(device => device.source === "shelly").map(device => this.refresh(device))
    ).then(() => undefined).finally(() => {
      this.reconcileTask = undefined;
    });
    return this.reconcileTask;
  }

  async command(command: DeviceCommand): Promise<Device> {
    const device = this.registry.get(command.deviceId);
    if (!device || device.source !== "shelly" || !device.host) throw new Error("DEVICE_NOT_FOUND");
    if (!device.capabilities.includes(command.capability)) throw new Error("CAPABILITY_NOT_SUPPORTED");

    const credentials = await getDeviceCredentials(device.id);
    const host = `http://${device.host}`;
    const componentId = device.componentId ?? 0;

    if (device.generation !== "gen1") {
      const namespace = rpcNamespace(device.componentKind);
      let method = "";
      const params: Record<string, unknown> = { id: componentId };
      if (command.capability === "toggle") {
        method = `${namespace}.Toggle`;
      } else if (command.capability === "turnOn" || command.capability === "turnOff") {
        method = `${namespace}.Set`;
        params.on = command.capability === "turnOn";
      } else if (command.capability === "setBrightness") {
        method = `${namespace}.Set`;
        params.on = true;
        params.brightness = Number(command.value);
      } else if (["open", "close", "stop"].includes(command.capability)) {
        method = `Cover.${command.capability.charAt(0).toUpperCase()}${command.capability.slice(1)}`;
      } else if (command.capability === "setTargetPosition") {
        const position = Number(command.value);
        if (!Number.isFinite(position) || position < 0 || position > 100) throw new Error("INVALID_POSITION");
        method = "Cover.GoToPosition";
        params.pos = Math.round(position);
      } else {
        throw new Error("CAPABILITY_NOT_SUPPORTED");
      }
      await requestJson(`${host}/rpc/${method}`, credentials.username, credentials.password, "POST", params);
    } else if (device.type === "windowCovering") {
      let action = command.capability;
      if (command.capability === "setTargetPosition") {
        const position = Number(command.value);
        if (!Number.isFinite(position) || position < 0 || position > 100) throw new Error("INVALID_POSITION");
        action = `to_pos&roller_pos=${Math.round(position)}`;
      }
      await requestJson(`${host}/roller/${componentId}?go=${action}`, credentials.username, credentials.password);
    } else if (device.type === "light") {
      const turn = command.capability === "turnOn" ? "on" : command.capability === "turnOff" ? "off" : command.capability === "toggle" ? "toggle" : "on";
      const gain = command.capability === "setBrightness" ? `&brightness=${Number(command.value)}` : "";
      await requestJson(`${host}/light/${componentId}?turn=${turn}${gain}`, credentials.username, credentials.password);
    } else {
      const turn = command.capability === "turnOn" ? "on" : command.capability === "turnOff" ? "off" : "toggle";
      await requestJson(`${host}/relay/${componentId}?turn=${turn}`, credentials.username, credentials.password);
    }

    return this.refresh(device);
  }
}
