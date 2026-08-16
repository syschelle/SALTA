import { randomUUID } from "node:crypto";
import { createSocket } from "node:dgram";
import { createServer, type Server } from "node:http";

const callbackRequestLimitBytes = 1_048_576;
const callbackRequestTimeoutMs = 5_000;
export const OPENCCU_CALLBACK_PORT = 18_099;

const interfacePorts: Readonly<Record<string, number>> = {
  "BidCos-Wired": 2000,
  "BidCos-RF": 2001,
  "HmIP-RF": 2010,
  VirtualDevices: 9292
};

export interface OpenCcuXmlRpcEvent {
  channelAddress: string;
  parameter: string;
  value: string | number | boolean;
}

export interface OpenCcuXmlRpcCallbackOptions {
  onEvent(event: OpenCcuXmlRpcEvent): void;
  onTopologyChange?(): void;
  onLog?(level: "info" | "warning", code: string, message: string, details?: Record<string, unknown>): void;
}

function xmlEscape(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlDecode(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function xmlStringValue(value: unknown): string {
  return `<value><string>${xmlEscape(value)}</string></value>`;
}

function xmlResponseString(value = ""): string {
  return `<?xml version="1.0"?><methodResponse><params><param>${xmlStringValue(value)}</param></params></methodResponse>`;
}

function xmlResponseArray(values: readonly string[] = []): string {
  return `<?xml version="1.0"?><methodResponse><params><param><value><array><data>${values.map(xmlStringValue).join("")}</data></array></value></param></params></methodResponse>`;
}

function xmlMethodName(xml: string): string {
  return xmlDecode(/<methodName>\s*([^<]+?)\s*<\/methodName>/i.exec(xml)?.[1]?.trim() ?? "");
}

function primitiveXmlValue(fragment: string): string | number | boolean {
  const boolean = /<boolean>\s*([^<]+?)\s*<\/boolean>/i.exec(fragment)?.[1]?.trim();
  if (boolean !== undefined) return boolean === "1" || boolean.toLowerCase() === "true";
  const integer = /<(?:int|i4)>\s*([^<]+?)\s*<\/(?:int|i4)>/i.exec(fragment)?.[1]?.trim();
  if (integer !== undefined) {
    const value = Number(integer);
    if (Number.isFinite(value)) return value;
  }
  const double = /<double>\s*([^<]+?)\s*<\/double>/i.exec(fragment)?.[1]?.trim();
  if (double !== undefined) {
    const value = Number(double);
    if (Number.isFinite(value)) return value;
  }
  const string = /<string>([\s\S]*?)<\/string>/i.exec(fragment)?.[1];
  if (string !== undefined) return xmlDecode(string.trim());
  return xmlDecode(fragment.replace(/<[^>]+>/g, "").trim());
}

function valueFragments(xml: string): string[] {
  return [...xml.matchAll(/<value>([\s\S]*?)<\/value>/gi)].map(match => match[1] ?? "");
}

function eventFromParams(params: Array<string | number | boolean>, instanceId: string): OpenCcuXmlRpcEvent | undefined {
  if (params.length < 4 || String(params[0]) !== instanceId) return undefined;
  const channelAddress = String(params[1] ?? "").trim();
  const parameter = String(params[2] ?? "").trim().toUpperCase();
  const value = params[3];
  if (!channelAddress || !parameter || !["string", "number", "boolean"].includes(typeof value)) return undefined;
  return { channelAddress, parameter, value: value as string | number | boolean };
}

/** Parses the direct event and system.multicall shapes emitted by OpenCCU XML-RPC interfaces. */
export function openCcuXmlRpcEvents(xml: string, instanceId: string): OpenCcuXmlRpcEvent[] {
  const method = xmlMethodName(xml);
  if (method === "event") {
    const paramsXml = /<params>([\s\S]*?)<\/params>/i.exec(xml)?.[1] ?? "";
    const params = [...paramsXml.matchAll(/<param>\s*<value>([\s\S]*?)<\/value>\s*<\/param>/gi)]
      .map(match => primitiveXmlValue(match[1] ?? ""));
    const event = eventFromParams(params, instanceId);
    return event ? [event] : [];
  }
  if (method !== "system.multicall") return [];

  const events: OpenCcuXmlRpcEvent[] = [];
  for (const match of xml.matchAll(/<struct>([\s\S]*?)<\/struct>/gi)) {
    const struct = match[1] ?? "";
    const nestedMethod = /<member>\s*<name>methodName<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/i.exec(struct)?.[1] ?? "";
    if (String(primitiveXmlValue(nestedMethod)) !== "event") continue;
    const data = /<member>\s*<name>params<\/name>\s*<value>\s*<array>\s*<data>([\s\S]*?)<\/data>\s*<\/array>\s*<\/value>\s*<\/member>/i.exec(struct)?.[1] ?? "";
    const params = valueFragments(data).map(primitiveXmlValue);
    const event = eventFromParams(params, instanceId);
    if (event) events.push(event);
  }
  return events;
}

export function openCcuButtonEventValue(parameter: string): number | undefined {
  if (parameter === "PRESS_SHORT") return 1002;
  if (parameter === "PRESS_LONG") return 1001;
  if (parameter === "PRESS_LONG_RELEASE") return 1003;
  return undefined;
}

export function openCcuXmlRpcInterfacePort(interfaceName: string): number | undefined {
  return interfacePorts[interfaceName];
}

function interfaceEndpoint(baseUrl: string, port: number): string {
  const endpoint = new URL(baseUrl);
  endpoint.protocol = "http:";
  endpoint.username = "";
  endpoint.password = "";
  endpoint.port = String(port);
  endpoint.pathname = "/";
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.toString();
}

function initRequest(callbackUrl: string, instanceId: string): string {
  return `<?xml version="1.0"?><methodCall><methodName>init</methodName><params><param>${xmlStringValue(callbackUrl)}</param><param>${xmlStringValue(instanceId)}</param></params></methodCall>`;
}

async function postXml(endpoint: string, body: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), callbackRequestTimeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "text/xml", accept: "text/xml" },
      body,
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function localAddressFor(host: string, port: number): Promise<string> {
  const socket = createSocket("udp4");
  return await new Promise<string>((resolve, reject) => {
    const cleanup = (): void => {
      socket.removeAllListeners();
      try { socket.close(); } catch { /* already closed */ }
    };
    socket.once("error", error => {
      cleanup();
      reject(error);
    });
    socket.connect(port, host, () => {
      const address = socket.address();
      cleanup();
      if (typeof address === "string" || !address.address) reject(new Error("OPENCCU_CALLBACK_LOCAL_ADDRESS_UNAVAILABLE"));
      else resolve(address.address);
    });
  });
}

export class OpenCcuXmlRpcCallbackServer {
  private server?: Server;
  private callbackUrl = "";
  private localAddress = "";
  private registrationSignature = "";
  private registrations = new Map<string, string>();
  private readonly instanceId = `SALTA-${randomUUID()}`;

  constructor(private readonly options: OpenCcuXmlRpcCallbackOptions) {}

  private log(level: "info" | "warning", code: string, message: string, details: Record<string, unknown> = {}): void {
    this.options.onLog?.(level, code, message, details);
  }

  invalidateRegistrations(): void {
    this.registrationSignature = "";
  }

  private async startServer(host: string, routePort: number): Promise<void> {
    const localAddress = await localAddressFor(host, routePort);
    if (this.server && this.localAddress === localAddress) return;
    await this.stop();
    this.localAddress = localAddress;
    this.server = createServer((request, response) => {
      if (request.method !== "POST") {
        response.statusCode = 405;
        response.end();
        return;
      }
      let bytes = 0;
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > callbackRequestLimitBytes) request.destroy();
        else chunks.push(chunk);
      });
      request.on("end", () => {
        const xml = Buffer.concat(chunks).toString("utf8");
        const method = xmlMethodName(xml);
        for (const event of openCcuXmlRpcEvents(xml, this.instanceId)) this.options.onEvent(event);
        if (["newDevices", "deleteDevices", "updateDevice", "replaceDevice", "readdedDevice"].includes(method)) this.options.onTopologyChange?.();
        response.statusCode = 200;
        response.setHeader("content-type", "text/xml");
        if (method === "system.listMethods") {
          response.end(xmlResponseArray(["event", "newDevices", "deleteDevices", "updateDevice", "replaceDevice", "readdedDevice", "listDevices", "system.listMethods", "system.multicall"]));
        } else if (method === "listDevices" || method === "system.multicall") response.end(xmlResponseArray());
        else response.end(xmlResponseString());
      });
      request.on("error", () => {
        if (!response.headersSent) response.destroy();
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(OPENCCU_CALLBACK_PORT, localAddress, () => resolve());
    });
    this.callbackUrl = `http://${localAddress}:${OPENCCU_CALLBACK_PORT}/`;
    this.log("info", "OPENCCU_CALLBACK_LISTENING", "OpenCCU XML-RPC callback listener started", { callbackUrl: this.callbackUrl });
  }

  async ensure(baseUrl: string, interfaces: readonly string[]): Promise<void> {
    const registerable = [...new Set(interfaces)]
      .map(interfaceName => ({ interfaceName, port: openCcuXmlRpcInterfacePort(interfaceName) }))
      .filter((entry): entry is { interfaceName: string; port: number } => entry.port !== undefined);
    if (!registerable.length) {
      await this.stop();
      return;
    }
    const signature = `${baseUrl}\u0000${registerable.map(entry => `${entry.interfaceName}:${entry.port}`).join(",")}`;
    if (this.registrationSignature === signature && this.registrations.size === registerable.length) return;

    const host = new URL(baseUrl).hostname;
    await this.startServer(host, registerable[0]!.port);
    const nextRegistrations = new Map<string, string>();
    await Promise.all(registerable.map(async ({ interfaceName, port }) => {
      const endpoint = interfaceEndpoint(baseUrl, port);
      try {
        await postXml(endpoint, initRequest(this.callbackUrl, this.instanceId));
        nextRegistrations.set(interfaceName, endpoint);
        this.log("info", "OPENCCU_CALLBACK_REGISTERED", "OpenCCU XML-RPC callback registered", { interfaceName, endpoint });
      } catch (error) {
        this.log("warning", "OPENCCU_CALLBACK_REGISTRATION_FAILED", "OpenCCU XML-RPC callback could not be registered", {
          interfaceName,
          endpoint,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }));
    if (nextRegistrations.size) this.registrations = nextRegistrations;
    this.registrationSignature = nextRegistrations.size === registerable.length ? signature : "";
  }

  async stop(unregister = true): Promise<void> {
    const registrations = [...this.registrations.entries()];
    this.registrations.clear();
    this.registrationSignature = "";
    if (unregister) {
      await Promise.all(registrations.map(async ([interfaceName, endpoint]) => {
        try {
          await postXml(endpoint, initRequest("", this.instanceId));
        } catch (error) {
          this.log("warning", "OPENCCU_CALLBACK_UNREGISTER_FAILED", "OpenCCU XML-RPC callback could not be unregistered cleanly", {
            interfaceName,
            endpoint,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }));
    }
    const server = this.server;
    this.server = undefined;
    this.callbackUrl = "";
    this.localAddress = "";
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  }
}
