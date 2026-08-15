import dgram from "node:dgram";
import { isHueLocalAddress } from "./hue-tls.js";

const HUE_MDNS_SERVICE = "_hue._tcp.local";
const MDNS_ADDRESS = "224.0.0.251";
const MDNS_PORT = 5353;
const MAX_DISCOVERED_BRIDGES = 16;

export interface DiscoveredHueBridge {
  address: string;
  baseUrl: string;
  name?: string;
  bridgeId?: string;
}

interface ParsedHueMdnsResponse {
  hue: boolean;
  name?: string;
  bridgeId?: string;
}

function encodeDnsName(name: string): Buffer {
  const parts: Buffer[] = [];
  for (const label of name.replace(/\.$/, "").split(".")) {
    const encoded = Buffer.from(label, "utf8");
    if (!encoded.length || encoded.length > 63) throw new Error("HUE_DISCOVERY_FAILED");
    parts.push(Buffer.from([encoded.length]), encoded);
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

export function createHueMdnsQuery(): Buffer {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(1, 4); // QDCOUNT
  const question = Buffer.alloc(4);
  question.writeUInt16BE(12, 0); // PTR
  question.writeUInt16BE(0x8001, 2); // IN + unicast-response bit
  return Buffer.concat([header, encodeDnsName(HUE_MDNS_SERVICE), question]);
}

function readDnsName(packet: Buffer, start: number, visited = new Set<number>()): { name: string; next: number } {
  if (start < 0 || start >= packet.length) throw new Error("HUE_DISCOVERY_INVALID_RESPONSE");
  const labels: string[] = [];
  let cursor = start;
  let next = start;
  let jumped = false;
  for (let part = 0; part < 128; part += 1) {
    if (cursor >= packet.length) throw new Error("HUE_DISCOVERY_INVALID_RESPONSE");
    const length = packet[cursor]!;
    if ((length & 0xc0) === 0xc0) {
      if (cursor + 1 >= packet.length) throw new Error("HUE_DISCOVERY_INVALID_RESPONSE");
      const pointer = ((length & 0x3f) << 8) | packet[cursor + 1]!;
      if (pointer >= packet.length || visited.has(pointer)) throw new Error("HUE_DISCOVERY_INVALID_RESPONSE");
      if (!jumped) next = cursor + 2;
      visited.add(pointer);
      const pointed = readDnsName(packet, pointer, visited);
      if (pointed.name) labels.push(pointed.name);
      jumped = true;
      break;
    }
    if (length === 0) {
      if (!jumped) next = cursor + 1;
      break;
    }
    if ((length & 0xc0) !== 0 || length > 63 || cursor + 1 + length > packet.length) throw new Error("HUE_DISCOVERY_INVALID_RESPONSE");
    labels.push(packet.subarray(cursor + 1, cursor + 1 + length).toString("utf8"));
    cursor += 1 + length;
    if (!jumped) next = cursor;
  }
  return { name: labels.join("."), next };
}

function txtValues(packet: Buffer, start: number, length: number): string[] {
  const end = start + length;
  if (end > packet.length) throw new Error("HUE_DISCOVERY_INVALID_RESPONSE");
  const values: string[] = [];
  let cursor = start;
  while (cursor < end) {
    const size = packet[cursor++]!;
    if (cursor + size > end) throw new Error("HUE_DISCOVERY_INVALID_RESPONSE");
    values.push(packet.subarray(cursor, cursor + size).toString("utf8"));
    cursor += size;
  }
  return values;
}

function serviceInstanceLabel(name: string): string | undefined {
  const suffix = `.${HUE_MDNS_SERVICE}`;
  const normalized = name.toLowerCase();
  if (!normalized.endsWith(suffix)) return undefined;
  const label = name.slice(0, -suffix.length).trim();
  return label || undefined;
}

export function parseHueMdnsResponse(packet: Buffer): ParsedHueMdnsResponse {
  if (packet.length < 12) return { hue: false };
  try {
    const questionCount = packet.readUInt16BE(4);
    const recordCount = packet.readUInt16BE(6) + packet.readUInt16BE(8) + packet.readUInt16BE(10);
    if (questionCount > 64 || recordCount > 512) return { hue: false };
    let cursor = 12;
    for (let index = 0; index < questionCount; index += 1) {
      const question = readDnsName(packet, cursor);
      cursor = question.next + 4;
      if (cursor > packet.length) return { hue: false };
    }

    let hue = false;
    let name: string | undefined;
    let bridgeId: string | undefined;
    for (let index = 0; index < recordCount; index += 1) {
      const owner = readDnsName(packet, cursor);
      cursor = owner.next;
      if (cursor + 10 > packet.length) return { hue: false };
      const type = packet.readUInt16BE(cursor);
      const dataLength = packet.readUInt16BE(cursor + 8);
      const dataStart = cursor + 10;
      const dataEnd = dataStart + dataLength;
      if (dataEnd > packet.length) return { hue: false };
      const ownerLower = owner.name.toLowerCase();
      if (ownerLower === HUE_MDNS_SERVICE || ownerLower.endsWith(`.${HUE_MDNS_SERVICE}`)) {
        hue = true;
        name ??= serviceInstanceLabel(owner.name);
      }
      if (type === 12) {
        const target = readDnsName(packet, dataStart).name;
        const targetLower = target.toLowerCase();
        if (ownerLower === HUE_MDNS_SERVICE && targetLower.endsWith(`.${HUE_MDNS_SERVICE}`)) {
          hue = true;
          name ??= serviceInstanceLabel(target);
        }
      } else if (type === 16 && ownerLower.endsWith(`.${HUE_MDNS_SERVICE}`)) {
        for (const value of txtValues(packet, dataStart, dataLength)) {
          const separator = value.indexOf("=");
          if (separator < 1) continue;
          const key = value.slice(0, separator).trim().toLowerCase();
          const text = value.slice(separator + 1).trim();
          if (key === "bridgeid" && /^[0-9a-f]{12,32}$/i.test(text)) bridgeId = text.toUpperCase();
        }
      }
      cursor = dataEnd;
    }
    return { hue, ...(name ? { name } : {}), ...(bridgeId ? { bridgeId } : {}) };
  } catch {
    return { hue: false };
  }
}

export async function discoverHueBridges(timeoutMs = 1_800): Promise<DiscoveredHueBridge[]> {
  const duration = Math.min(5_000, Math.max(500, Math.round(timeoutMs)));
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  const bridges = new Map<string, DiscoveredHueBridge>();
  const query = createHueMdnsQuery();

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(retry);
      try { socket.close(); } catch { /* socket may not have finished binding */ }
      if (error) reject(error); else resolve([...bridges.values()].sort((a, b) => (a.name ?? a.address).localeCompare(b.name ?? b.address)));
    };
    const sendQuery = (): void => {
      if (settled) return;
      socket.send(query, MDNS_PORT, MDNS_ADDRESS, error => {
        if (error && bridges.size === 0) finish(new Error("HUE_DISCOVERY_FAILED"));
      });
    };
    const timeout = setTimeout(() => finish(), duration);
    const retry = setTimeout(sendQuery, Math.min(600, Math.floor(duration / 2)));
    timeout.unref();
    retry.unref();

    socket.on("message", (message, remote) => {
      if (!isHueLocalAddress(remote.address)) return;
      const parsed = parseHueMdnsResponse(message);
      if (!parsed.hue) return;
      const key = parsed.bridgeId ?? remote.address;
      bridges.set(key, {
        address: remote.address,
        baseUrl: `https://${remote.address}`,
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.bridgeId ? { bridgeId: parsed.bridgeId } : {})
      });
      if (bridges.size >= MAX_DISCOVERED_BRIDGES) finish();
    });
    socket.once("error", () => finish(new Error("HUE_DISCOVERY_FAILED")));
    socket.bind(0, "0.0.0.0", sendQuery);
  });
}
