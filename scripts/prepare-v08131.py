from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")

def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"missing replacement anchor in {path}: {old[:120]!r}")
    text = text.replace(old, new, 1)
    write(path, text)

# Runtime OpenCCU JSON-RPC client: actively renew long-lived sessions and
# recover the real OpenCCU expired-session wording seen in production.
replace_once(
    "src/openccu-adapter.ts",
    "const requestTimeoutMs = 15_000;\nconst catalogRefreshMs = 15 * 60_000;",
    "const requestTimeoutMs = 15_000;\nconst sessionRenewIntervalMs = 5 * 60_000;\nconst catalogRefreshMs = 15 * 60_000;",
)
replace_once(
    "src/openccu-adapter.ts",
    '  return /(invalid|unknown|expired|missing) session|session (?:is )?(?:invalid|unknown|expired|missing)|not (?:logged|signed) in/.test(message);',
    '  return /(invalid|unknown|expired|missing) session|session (?:is )?(?:invalid|unknown|expired|missing)|not (?:logged|signed) in|access denied\\s*\\([^)]*needed\\s+0\\)/.test(message);',
)
replace_once(
    "src/openccu-adapter.ts",
    "class OpenCcuJsonRpcClient {\n  private sessionId?: string;\n  private loginTask?: Promise<void>;",
    "class OpenCcuJsonRpcClient {\n  private sessionId?: string;\n  private sessionRenewedAt = 0;\n  private loginTask?: Promise<void>;",
)
replace_once(
    "src/openccu-adapter.ts",
    "      this.sessionId = sessionId;\n    })().finally(() => {",
    "      this.sessionId = sessionId;\n      this.sessionRenewedAt = Date.now();\n    })().finally(() => {",
)
replace_once(
    "src/openccu-adapter.ts",
    "  invalidateSession(): void {\n    this.sessionId = undefined;\n  }\n\n  async call(method: string, params: JsonRecord = {}, interfaceName?: string): Promise<unknown> {\n    for (let attempt = 0; attempt < 2; attempt += 1) {\n      await this.login();\n      if (!this.sessionId) throw new OpenCcuAdapterError(\"OPENCCU_AUTHENTICATION_FAILED\", \"Session.login\");\n      try {\n        return await this.post(method, { _session_id_: this.sessionId, ...params }, interfaceName);\n      } catch (error) {\n        const info = openCcuErrorInfo(error);\n        if (sessionInvalidError(info) && attempt === 0) {\n          this.invalidateSession();\n          continue;\n        }\n        throw error;\n      }\n    }\n    throw new OpenCcuAdapterError(\"OPENCCU_REQUEST_FAILED\", method);\n  }",
    "  invalidateSession(): void {\n    this.sessionId = undefined;\n    this.sessionRenewedAt = 0;\n  }\n\n  private async renewSessionIfNeeded(): Promise<void> {\n    const sessionId = this.sessionId;\n    if (!sessionId || Date.now() - this.sessionRenewedAt < sessionRenewIntervalMs) return;\n    const result = await this.post(\"Session.renew\", { _session_id_: sessionId }, undefined, false);\n    const renewedSessionId = typeof result === \"string\"\n      ? result.trim()\n      : stringValue(record(result)._session_id_ ?? record(result).session_id);\n    if (renewedSessionId) this.sessionId = renewedSessionId;\n    this.sessionRenewedAt = Date.now();\n  }\n\n  async call(method: string, params: JsonRecord = {}, interfaceName?: string): Promise<unknown> {\n    for (let attempt = 0; attempt < 2; attempt += 1) {\n      await this.login();\n      try {\n        await this.renewSessionIfNeeded();\n        if (!this.sessionId) throw new OpenCcuAdapterError(\"OPENCCU_AUTHENTICATION_FAILED\", \"Session.login\");\n        return await this.post(method, { _session_id_: this.sessionId, ...params }, interfaceName);\n      } catch (error) {\n        const info = openCcuErrorInfo(error);\n        if (sessionInvalidError(info) && attempt === 0) {\n          this.invalidateSession();\n          continue;\n        }\n        throw error;\n      }\n    }\n    throw new OpenCcuAdapterError(\"OPENCCU_REQUEST_FAILED\", method);\n  }",
)
replace_once(
    "src/openccu-adapter.ts",
    "    const sessionId = this.sessionId;\n    this.sessionId = undefined;\n    if (!sessionId) return true;",
    "    const sessionId = this.sessionId;\n    this.sessionId = undefined;\n    this.sessionRenewedAt = 0;\n    if (!sessionId) return true;",
)

# Dedicated thermostat control client uses its own long-lived JSON-RPC session.
replace_once(
    "src/openccu-control-client.ts",
    "const requestTimeoutMs = 15_000;",
    "const requestTimeoutMs = 15_000;\nconst sessionRenewIntervalMs = 5 * 60_000;",
)
replace_once(
    "src/openccu-control-client.ts",
    '  return /(invalid|unknown|expired|missing) session|session (?:is )?(?:invalid|unknown|expired|missing)|not (?:logged|signed) in/.test(message);',
    '  return /(invalid|unknown|expired|missing) session|session (?:is )?(?:invalid|unknown|expired|missing)|not (?:logged|signed) in|access denied\\s*\\([^)]*needed\\s+0\\)/.test(message);',
)
replace_once(
    "src/openccu-control-client.ts",
    "export class OpenCcuControlClient implements OpenCcuControlTransport {\n  private sessionId?: string;\n  private loginTask?: Promise<void>;",
    "export class OpenCcuControlClient implements OpenCcuControlTransport {\n  private sessionId?: string;\n  private sessionRenewedAt = 0;\n  private loginTask?: Promise<void>;",
)
replace_once(
    "src/openccu-control-client.ts",
    "    this.sessionId = undefined;\n    this.loginTask = undefined;\n    this.connectionSignature = signature;",
    "    this.sessionId = undefined;\n    this.sessionRenewedAt = 0;\n    this.loginTask = undefined;\n    this.connectionSignature = signature;",
)
replace_once(
    "src/openccu-control-client.ts",
    "      this.sessionId = sessionId;\n    })().finally(() => {",
    "      this.sessionId = sessionId;\n      this.sessionRenewedAt = Date.now();\n    })().finally(() => {",
)
replace_once(
    "src/openccu-control-client.ts",
    "  async call(connection: OpenCcuControlConnection, method: string, params: JsonRecord = {}): Promise<unknown> {\n    this.resetForConnection(connection);\n    for (let attempt = 0; attempt < 2; attempt += 1) {\n      await this.login(connection);\n      const sessionId = this.sessionId;\n      if (!sessionId) throw new Error(\"OPENCCU_AUTHENTICATION_FAILED\");\n      try {\n        return await this.post(connection, method, { _session_id_: sessionId, ...params });\n      } catch (error) {\n        if (attempt === 0 && sessionInvalid(error)) {\n          this.sessionId = undefined;\n          continue;\n        }\n        throw error;\n      }\n    }\n    throw new Error(\"OPENCCU_REQUEST_FAILED\");\n  }",
    "  private invalidateSession(): void {\n    this.sessionId = undefined;\n    this.sessionRenewedAt = 0;\n  }\n\n  private async renewSessionIfNeeded(connection: OpenCcuControlConnection): Promise<void> {\n    const sessionId = this.sessionId;\n    if (!sessionId || Date.now() - this.sessionRenewedAt < sessionRenewIntervalMs) return;\n    const result = await this.post(connection, \"Session.renew\", { _session_id_: sessionId });\n    const renewedSessionId = typeof result === \"string\"\n      ? result.trim()\n      : stringValue(record(result)._session_id_ ?? record(result).session_id);\n    if (renewedSessionId) this.sessionId = renewedSessionId;\n    this.sessionRenewedAt = Date.now();\n  }\n\n  async call(connection: OpenCcuControlConnection, method: string, params: JsonRecord = {}): Promise<unknown> {\n    this.resetForConnection(connection);\n    for (let attempt = 0; attempt < 2; attempt += 1) {\n      await this.login(connection);\n      try {\n        await this.renewSessionIfNeeded(connection);\n        const sessionId = this.sessionId;\n        if (!sessionId) throw new Error(\"OPENCCU_AUTHENTICATION_FAILED\");\n        return await this.post(connection, method, { _session_id_: sessionId, ...params });\n      } catch (error) {\n        if (attempt === 0 && sessionInvalid(error)) {\n          this.invalidateSession();\n          continue;\n        }\n        throw error;\n      }\n    }\n    throw new Error(\"OPENCCU_REQUEST_FAILED\");\n  }",
)
replace_once(
    "src/openccu-control-client.ts",
    "    this.sessionId = undefined;\n    this.loginTask = undefined;\n    this.connectionSignature = \"\";",
    "    this.sessionId = undefined;\n    this.sessionRenewedAt = 0;\n    this.loginTask = undefined;\n    this.connectionSignature = \"\";",
)

# Runtime regression for OpenCCU's real expired-session response.
replace_once(
    "src/openccu-diagnostics.test.ts",
    "  it(\"reuses one runtime session across periodic synchronizations and logs out on stop\", async () => {",
    "  it(\"re-authenticates the runtime session when OpenCCU reports GUEST needed 0\", async () => {\n    let loginNumber = 0;\n    let rejectFirstInterfaceCall = true;\n    vi.stubGlobal(\"fetch\", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {\n      const body = JSON.parse(String(init?.body ?? \"{}\")) as { id: number; method: string };\n      if (body.method === \"Session.login\") return rpcResult(body.id, `session-${++loginNumber}`);\n      if (body.method === \"Interface.listInterfaces\") {\n        if (rejectFirstInterfaceCall) {\n          rejectFirstInterfaceCall = false;\n          return rpcError(body.id, 400, 'access denied (\"GUEST\" needed 0)');\n        }\n        return rpcResult(body.id, [\"BidCos-RF\"]);\n      }\n      if (body.method === \"Device.listAllDetail\") return rpcResult(body.id, []);\n      if (body.method === \"Interface.listDevices\") return rpcResult(body.id, []);\n      if (body.method === \"Session.logout\") return rpcResult(body.id, true);\n      throw new Error(`Unexpected method ${body.method}`);\n    }));\n\n    const adapter = new OpenCcuAdapter(registry);\n    await adapter.reconcile(true, \"manual\");\n    await adapter.stop();\n\n    expect(loginNumber).toBe(2);\n    expect(adapter.getStatus().connected).toBe(true);\n  });\n\n  it(\"reuses one runtime session across periodic synchronizations and logs out on stop\", async () => {",
)

# Dedicated behavior tests for thermostat/control sessions.
write(
    "src/openccu-session-renewal.test.ts",
    '''import { afterEach, describe, expect, it, vi } from "vitest";\nimport { OpenCcuControlClient } from "./openccu-control-client.js";\n\nfunction rpcResult(id: number, result: unknown): Response {\n  return new Response(JSON.stringify({ jsonrpc: "1.1", id, result }), {\n    status: 200,\n    headers: { "content-type": "application/json" }\n  });\n}\n\nfunction rpcError(id: number, code: number, message: string): Response {\n  return new Response(JSON.stringify({ jsonrpc: "1.1", id, error: { code, message } }), {\n    status: 200,\n    headers: { "content-type": "application/json" }\n  });\n}\n\nafterEach(() => {\n  vi.useRealTimers();\n  vi.restoreAllMocks();\n  vi.unstubAllGlobals();\n});\n\nconst connection = { baseUrl: "http://openccu.local", username: "salta", password: "secret" };\n\ndescribe("OpenCCU JSON-RPC session renewal", () => {\n  it("re-authenticates and retries when OpenCCU reports access denied GUEST needed 0", async () => {\n    let loginNumber = 0;\n    let firstRead = true;\n    const sessionIds: string[] = [];\n    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {\n      const body = JSON.parse(String(init?.body ?? "{}")) as { id: number; method: string; params: Record<string, string> };\n      if (body.method === "Session.login") return rpcResult(body.id, `session-${++loginNumber}`);\n      if (body.method === "Interface.getParamset") {\n        sessionIds.push(body.params._session_id_);\n        if (firstRead) {\n          firstRead = false;\n          return rpcError(body.id, 400, 'access denied ("GUEST" needed 0)');\n        }\n        return rpcResult(body.id, { SET_TEMPERATURE: "20.000000" });\n      }\n      throw new Error(`Unexpected method ${body.method}`);\n    }));\n\n    const client = new OpenCcuControlClient();\n    const result = await client.call(connection, "Interface.getParamset", {\n      interface: "BidCos-RF",\n      address: "NEQ0934956:2",\n      paramsetKey: "VALUES"\n    });\n\n    expect(result).toEqual({ SET_TEMPERATURE: "20.000000" });\n    expect(loginNumber).toBe(2);\n    expect(sessionIds).toEqual(["session-1", "session-2"]);\n  });\n\n  it("renews a long-lived session before reusing it", async () => {\n    vi.useFakeTimers();\n    vi.setSystemTime(new Date("2026-10-23T17:00:00Z"));\n    const methods: string[] = [];\n    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {\n      const body = JSON.parse(String(init?.body ?? "{}")) as { id: number; method: string };\n      methods.push(body.method);\n      if (body.method === "Session.login") return rpcResult(body.id, "session-1");\n      if (body.method === "Session.renew") return rpcResult(body.id, true);\n      if (body.method === "Interface.getParamset") return rpcResult(body.id, { SET_TEMPERATURE: "20.000000" });\n      if (body.method === "Session.logout") return rpcResult(body.id, true);\n      throw new Error(`Unexpected method ${body.method}`);\n    }));\n\n    const client = new OpenCcuControlClient();\n    await client.call(connection, "Interface.getParamset", { interface: "BidCos-RF", address: "NEQ0934956:2", paramsetKey: "VALUES" });\n    vi.advanceTimersByTime(6 * 60_000);\n    await client.call(connection, "Interface.getParamset", { interface: "BidCos-RF", address: "NEQ0934956:2", paramsetKey: "VALUES" });\n    await client.close();\n\n    expect(methods).toEqual([\n      "Session.login",\n      "Interface.getParamset",\n      "Session.renew",\n      "Interface.getParamset",\n      "Session.logout"\n    ]);\n  });\n});\n''',
)

# Release contract.
validator = read("scripts/validate-release.mjs")
anchor = 'console.log(`Release validator contract: SALTA v${version} / test-config-from-tsconfig.json`);'
checks = '''const v08131ControlClientSource = read("src/openccu-control-client.ts");\nconst v08131SessionTestSource = read("src/openccu-session-renewal.test.ts");\nif (!openCcuAdapterSource.includes('"Session.renew"') || !v08131ControlClientSource.includes('"Session.renew"')) fail("OpenCCU runtime and thermostat clients must renew long-lived JSON-RPC sessions");\nif (!openCcuAdapterSource.includes("needed\\\\s+0") || !v08131ControlClientSource.includes("needed\\\\s+0")) fail("OpenCCU clients must recover the production GUEST-needed-0 expired-session response");\nif (!v08131SessionTestSource.includes("re-authenticates and retries when OpenCCU reports access denied GUEST needed 0") || !v08131SessionTestSource.includes("renews a long-lived session before reusing it")) fail("OpenCCU session renewal/re-authentication regression coverage is missing");\n\n'''
if anchor not in validator:
    raise SystemExit("release-validator footer anchor missing")
validator = validator.replace(anchor, checks + anchor, 1)
write("scripts/validate-release.mjs", validator)

# Release notes and changelog.
changelog = read("CHANGELOG.md")
entry = '''## 0.8.131 - OpenCCU JSON-RPC session renewal\n\n- Renew long-lived OpenCCU JSON-RPC sessions before they can silently expire.\n- Treat OpenCCU's real `access denied ("GUEST" needed 0)` response as an expired/unauthenticated session and perform one automatic re-login plus retry.\n- Apply the recovery to both the normal OpenCCU synchronization client and the dedicated thermostat-control client.\n- Prevent manual thermostat changes and scheduled temperature automations from failing after SALTA has been running for an extended period.\n- Add behavior regression coverage for proactive renewal and production-style expired-session recovery.\n\n'''
if not changelog.startswith("# Changelog\n\n"):
    raise SystemExit("unexpected CHANGELOG header")
write("CHANGELOG.md", "# Changelog\n\n" + entry + changelog[len("# Changelog\n\n"):])

write(
    "RELEASE_TEXT.md",
    '''# SALTA v0.8.131\n\nSALTA v0.8.131 keeps OpenCCU JSON-RPC sessions alive and automatically recovers sessions that OpenCCU reports as unauthenticated after expiration.\n\n## Changes\n\n- Both SALTA OpenCCU JSON-RPC clients now renew long-lived sessions periodically using `Session.renew`.\n- The dedicated thermostat-control client no longer keeps an unrenewed session indefinitely.\n- The normal OpenCCU synchronization client uses the same renewal behavior.\n- `access denied ("GUEST" needed 0)` is recognized as the OpenCCU expired/unauthenticated-session response seen in production.\n- On that response SALTA discards the stale session, performs one fresh `Session.login`, and retries the original OpenCCU request once.\n- Existing thermostat datapoints, classic HomeMatic/BidCos mappings, XML-RPC callbacks and the v0.8.130 contact-event fix remain unchanged.\n\n## Root Cause\n\nSALTA authenticated correctly with OpenCCU but cached the returned JSON-RPC session ID indefinitely. The clients never called `Session.renew`, even though OpenCCU explicitly requires sessions to be renewed before they expire.\n\nAfter expiration, OpenCCU can answer authenticated methods such as `Interface.getParamset` and `Interface.setValue` with `access denied ("GUEST" needed 0)`. SALTA's previous expired-session detector did not recognize this response, so it kept reusing the stale session instead of logging in again. This caused manual wall-thermostat changes and scheduled temperature automations to fail until a fresh SALTA/OpenCCU session was created.\n\nv0.8.131 adds proactive session renewal and a bounded one-time re-login/retry path for this production response.\n\n## Compatibility\n\n- No database schema change or migration is required.\n- Existing OpenCCU credentials and device mappings remain unchanged.\n- Classic HomeMatic/BidCos thermostat datapoints remain unchanged.\n- OpenCCU XML-RPC callbacks and contact automations remain unchanged.\n- No npm dependency is added or changed.\n- No new mandatory environment variable is introduced.\n- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.\n\n## Tests\n\n- Regression coverage verifies automatic re-login and retry for the production `access denied ("GUEST" needed 0)` response.\n- Regression coverage verifies that the dedicated thermostat-control client renews a long-lived session before reuse.\n- Runtime adapter coverage verifies the same automatic re-authentication behavior for normal OpenCCU synchronization.\n- Release-validator coverage enforces renewal and expired-session recovery in both OpenCCU JSON-RPC clients.\n- Release validator, JavaScript syntax checks, TypeScript production build and the complete test suite must pass before release.\n\n## Production update\n\n```bash\ncd /opt/SALTA\ngit pull --ff-only origin main\ndocker compose --env-file .env -f docker-compose.image.yml config\ndocker compose --env-file .env -f docker-compose.image.yml pull\ndocker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans\ndocker compose --env-file .env -f docker-compose.image.yml ps\n```\n\nDo not use `docker compose down -v` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.\n''',
)

print("Prepared SALTA v0.8.131 OpenCCU session renewal fix")
