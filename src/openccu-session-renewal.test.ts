import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenCcuControlClient } from "./openccu-control-client.js";

function rpcResult(id: number, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "1.1", id, result }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function rpcError(id: number, code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: "1.1", id, error: { code, message } }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const connection = { baseUrl: "http://openccu.local", username: "salta", password: "secret" };

describe("OpenCCU JSON-RPC session renewal", () => {
  it("re-authenticates and retries when OpenCCU reports access denied GUEST needed 0", async () => {
    let loginNumber = 0;
    let firstRead = true;
    const sessionIds: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { id: number; method: string; params: Record<string, string> };
      if (body.method === "Session.login") return rpcResult(body.id, `session-${++loginNumber}`);
      if (body.method === "Interface.getParamset") {
        sessionIds.push(body.params._session_id_);
        if (firstRead) {
          firstRead = false;
          return rpcError(body.id, 400, 'access denied ("GUEST" needed 0)');
        }
        return rpcResult(body.id, { SET_TEMPERATURE: "20.000000" });
      }
      throw new Error(`Unexpected method ${body.method}`);
    }));

    const client = new OpenCcuControlClient();
    const result = await client.call(connection, "Interface.getParamset", {
      interface: "BidCos-RF",
      address: "NEQ0934956:2",
      paramsetKey: "VALUES"
    });

    expect(result).toEqual({ SET_TEMPERATURE: "20.000000" });
    expect(loginNumber).toBe(2);
    expect(sessionIds).toEqual(["session-1", "session-2"]);
  });

  it("renews a long-lived session before reusing it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T17:00:00Z"));
    const methods: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { id: number; method: string };
      methods.push(body.method);
      if (body.method === "Session.login") return rpcResult(body.id, "session-1");
      if (body.method === "Session.renew") return rpcResult(body.id, true);
      if (body.method === "Interface.getParamset") return rpcResult(body.id, { SET_TEMPERATURE: "20.000000" });
      if (body.method === "Session.logout") return rpcResult(body.id, true);
      throw new Error(`Unexpected method ${body.method}`);
    }));

    const client = new OpenCcuControlClient();
    await client.call(connection, "Interface.getParamset", { interface: "BidCos-RF", address: "NEQ0934956:2", paramsetKey: "VALUES" });
    vi.advanceTimersByTime(6 * 60_000);
    await client.call(connection, "Interface.getParamset", { interface: "BidCos-RF", address: "NEQ0934956:2", paramsetKey: "VALUES" });
    await client.close();

    expect(methods).toEqual([
      "Session.login",
      "Interface.getParamset",
      "Session.renew",
      "Interface.getParamset",
      "Session.logout"
    ]);
  });
});
