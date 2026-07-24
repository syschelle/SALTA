import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./server.ts", import.meta.url), "utf8");

describe("explicit Fastify route rate limiting", () => {
  it("registers the official Fastify rate-limit plugin", () => {
    expect(source).toContain('import fastifyRateLimit from "@fastify/rate-limit"');
    expect(source).toContain("void app.register(fastifyRateLimit");
    expect(source).toContain("global: false");
  });

  it.each([
    'app.post<{ Body: unknown }>("/auth/login", {',
    'app.get("/api/readiness", {',
    'app.get("/api/rooms", {',
    'app.get("/api/settings/shelly", {',
    'app.get("/api/settings/openccu", {',
    'app.put<{ Body: unknown }>("/api/settings/openccu", {',
    'app.delete("/api/settings/openccu", {',
    'app.post("/api/adapters/openccu/reconcile", {',
    'app.post<{ Params: { id: string }; Body: unknown }>("/api/devices/:id/command", {',
    'app.get("/api/commands", {'
  ])("adds an explicit per-route limit to %s", routeDeclaration => {
    const start = source.indexOf(routeDeclaration);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(source.slice(start, start + 280)).toContain("config: { rateLimit:");
  });
  it("limits Phoscon pairing and reconciliation as expensive operations", () => {
    expect(source).toContain('path === "/api/adapters/shelly/reconcile" || path === "/api/adapters/phoscon/reconcile" || path === "/api/adapters/openccu/reconcile"');
    expect(source).toContain('path === "/api/settings/phoscon/pair" && request.method === "POST"');
    expect(source).toContain('security.consumeRateLimit(`phoscon-pairing:${ip}`, 5, rateWindowMs)');
  });

});
