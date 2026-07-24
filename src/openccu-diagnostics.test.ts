import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db.js", () => ({
  clearOpenCcuSettings: vi.fn(),
  getOpenCcuConnection: vi.fn(async () => ({ baseUrl: "http://openccu.local", username: "salta", password: "secret" })),
  updateOpenCcuSettings: vi.fn(),
  writeSystemLog: vi.fn(async () => undefined)
}));

import { OpenCcuAdapter } from "./openccu-adapter.js";
import type { DeviceRegistry } from "./registry.js";

const registry = {
  all: () => [],
  get: () => undefined,
  set: vi.fn(),
  restore: vi.fn(),
  removeSource: vi.fn()
} as unknown as DeviceRegistry;

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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OpenCCU in-app diagnostics", () => {
  it("keeps a Device.listAllDetail Tcl error as a visible warning and continues", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { id: number; method: string };
      if (body.method === "Session.login") return rpcResult(body.id, "session-id");
      if (body.method === "Interface.listInterfaces") return rpcResult(body.id, ["HmIP-RF"]);
      if (body.method === "Device.listAllDetail") return rpcError(body.id, 601, "TCL error");
      if (body.method === "Interface.listDevices") return rpcResult(body.id, []);
      if (body.method === "Session.logout") return rpcResult(body.id, true);
      throw new Error(`Unexpected method ${body.method}`);
    }));

    const adapter = new OpenCcuAdapter(registry);
    const report = await adapter.diagnose("http://openccu.local", "salta", "secret");

    expect(report.ok).toBe(true);
    expect(report.interfaces).toEqual(["HmIP-RF"]);
    expect(report.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "Session.login", status: "ok" }),
      expect.objectContaining({ method: "Interface.listInterfaces", status: "ok" }),
      expect.objectContaining({ method: "Device.listAllDetail", status: "warning", code: "OPENCCU_API_ERROR", remoteCode: "601", message: "TCL error" }),
      expect.objectContaining({ method: "Interface.listDevices", interfaceName: "HmIP-RF", status: "ok" }),
      expect.objectContaining({ method: "Session.logout", status: "ok" })
    ]));
  });

  it("identifies the exact blocking JSON-RPC method", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { id: number; method: string };
      if (body.method === "Session.login") return rpcResult(body.id, "session-id");
      if (body.method === "Interface.listInterfaces") return rpcError(body.id, 601, "TCL error");
      if (body.method === "Session.logout") return rpcResult(body.id, true);
      throw new Error(`Unexpected method ${body.method}`);
    }));

    const adapter = new OpenCcuAdapter(registry);
    const report = await adapter.diagnose("http://openccu.local", "salta", "secret");

    expect(report.ok).toBe(false);
    expect(report.steps).toContainEqual(expect.objectContaining({
      method: "Interface.listInterfaces",
      status: "error",
      code: "OPENCCU_API_ERROR",
      remoteCode: "601",
      message: "TCL error"
    }));
  });
  it("maps OpenCCU error 501 to the combined credentials or session-limit error", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { id: number; method: string };
      if (body.method === "Session.login") return rpcError(body.id, 501, "Session.login: invalid credentials or too many sessions");
      throw new Error(`Unexpected method ${body.method}`);
    }));

    const adapter = new OpenCcuAdapter(registry);
    const report = await adapter.diagnose("http://openccu.local", "salta", "secret");

    expect(report.ok).toBe(false);
    expect(report.steps).toContainEqual(expect.objectContaining({
      method: "Session.login",
      status: "error",
      code: "OPENCCU_AUTH_OR_SESSION_LIMIT",
      remoteCode: "501"
    }));
  });


  it("creates a fresh session automatically after an OpenCCU restart", async () => {
    const methods: string[] = [];
    let failNextInterfaceCall = false;
    let loginNumber = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { id: number; method: string };
      methods.push(body.method);
      if (body.method === "Session.login") return rpcResult(body.id, `session-${++loginNumber}`);
      if (body.method === "Interface.listInterfaces") {
        if (failNextInterfaceCall) {
          failNextInterfaceCall = false;
          const error = new Error("connect ECONNREFUSED") as Error & { cause?: { code: string } };
          error.cause = { code: "ECONNREFUSED" };
          throw error;
        }
        return rpcResult(body.id, ["BidCos-RF"]);
      }
      if (body.method === "Device.listAllDetail") return rpcResult(body.id, []);
      if (body.method === "Interface.listDevices") return rpcResult(body.id, []);
      if (body.method === "Session.logout") return rpcResult(body.id, true);
      throw new Error(`Unexpected method ${body.method}`);
    }));

    const adapter = new OpenCcuAdapter(registry);
    await adapter.reconcile(true, "manual");
    failNextInterfaceCall = true;
    await expect(adapter.reconcile(false, "manual")).rejects.toThrow("OPENCCU_UNREACHABLE");
    await adapter.reconcile(false, "manual");
    await adapter.stop();

    expect(methods.filter(method => method === "Session.login")).toHaveLength(2);
    expect(adapter.getStatus().connected).toBe(true);
  });

  it("reuses one runtime session across periodic synchronizations and logs out on stop", async () => {
    const methods: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { id: number; method: string };
      methods.push(body.method);
      if (body.method === "Session.login") return rpcResult(body.id, "persistent-session");
      if (body.method === "Interface.listInterfaces") return rpcResult(body.id, ["BidCos-RF"]);
      if (body.method === "Device.listAllDetail") return rpcResult(body.id, []);
      if (body.method === "Interface.listDevices") return rpcResult(body.id, []);
      if (body.method === "Session.logout") return rpcResult(body.id, true);
      throw new Error(`Unexpected method ${body.method}`);
    }));

    const adapter = new OpenCcuAdapter(registry);
    await adapter.reconcile(true, "manual");
    await adapter.reconcile(false, "manual");
    await adapter.stop();

    expect(methods.filter(method => method === "Session.login")).toHaveLength(1);
    expect(methods.filter(method => method === "Session.logout")).toHaveLength(1);
  });

});
