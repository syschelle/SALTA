import { openCcuRpcEndpoint, record, stringifyRpcParams, stringValue, unwrapRpcResult, type JsonRecord } from "./openccu-core.js";

export interface OpenCcuControlConnection {
  baseUrl: string;
  username: string;
  password: string;
}

export interface OpenCcuControlTransport {
  call(connection: OpenCcuControlConnection, method: string, params?: JsonRecord): Promise<unknown>;
  close?(): Promise<void>;
}

const requestTimeoutMs = 15_000;

export function openCcuSetValueWireType(valueType: unknown): string {
  const normalized = String(valueType ?? "").trim().toLowerCase();
  return normalized === "float" ? "double" : normalized;
}

export function openCcuControlRpcParams(method: string, params: JsonRecord): JsonRecord {
  const serialized = stringifyRpcParams(params);
  if (method === "Interface.setValue" && "type" in serialized) {
    serialized.type = openCcuSetValueWireType(serialized.type);
  }
  return serialized;
}

function sessionInvalid(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /(invalid|unknown|expired|missing) session|session (?:is )?(?:invalid|unknown|expired|missing)|not (?:logged|signed) in/.test(message);
}

export class OpenCcuControlClient implements OpenCcuControlTransport {
  private sessionId?: string;
  private loginTask?: Promise<void>;
  private connectionSignature = "";
  private activeConnection?: OpenCcuControlConnection;
  private requestId = 0;

  private signature(connection: OpenCcuControlConnection): string {
    return `${connection.baseUrl}\u0000${connection.username}\u0000${connection.password}`;
  }

  private resetForConnection(connection: OpenCcuControlConnection): void {
    const signature = this.signature(connection);
    if (signature === this.connectionSignature) return;
    this.sessionId = undefined;
    this.loginTask = undefined;
    this.connectionSignature = signature;
    this.activeConnection = { ...connection };
  }

  private async post(connection: OpenCcuControlConnection, method: string, params: JsonRecord): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(openCcuRpcEndpoint(connection.baseUrl), {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ method, params: openCcuControlRpcParams(method, params), jsonrpc: "1.1", id: ++this.requestId }),
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
      if (error instanceof Error && error.name === "AbortError") throw new Error("OPENCCU_TIMEOUT");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async login(connection: OpenCcuControlConnection): Promise<void> {
    this.resetForConnection(connection);
    if (this.sessionId) return;
    if (this.loginTask) return this.loginTask;
    if (!connection.username.trim() || !connection.password) throw new Error("OPENCCU_CREDENTIALS_REQUIRED");

    const task = (async () => {
      const result = await this.post(connection, "Session.login", {
        username: connection.username,
        password: connection.password
      });
      const sessionId = typeof result === "string"
        ? result.trim()
        : stringValue(record(result)._session_id_ ?? record(result).session_id);
      if (!sessionId) throw new Error("OPENCCU_AUTHENTICATION_FAILED");
      this.sessionId = sessionId;
    })().finally(() => {
      if (this.loginTask === task) this.loginTask = undefined;
    });
    this.loginTask = task;
    return task;
  }

  async call(connection: OpenCcuControlConnection, method: string, params: JsonRecord = {}): Promise<unknown> {
    this.resetForConnection(connection);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.login(connection);
      const sessionId = this.sessionId;
      if (!sessionId) throw new Error("OPENCCU_AUTHENTICATION_FAILED");
      try {
        return await this.post(connection, method, { _session_id_: sessionId, ...params });
      } catch (error) {
        if (attempt === 0 && sessionInvalid(error)) {
          this.sessionId = undefined;
          continue;
        }
        throw error;
      }
    }
    throw new Error("OPENCCU_REQUEST_FAILED");
  }

  async close(): Promise<void> {
    await this.loginTask?.catch(() => undefined);
    const sessionId = this.sessionId;
    const connection = this.activeConnection;
    this.sessionId = undefined;
    this.loginTask = undefined;
    this.connectionSignature = "";
    this.activeConnection = undefined;
    if (!sessionId || !connection) return;
    await this.post(connection, "Session.logout", { _session_id_: sessionId }).catch(() => undefined);
  }
}