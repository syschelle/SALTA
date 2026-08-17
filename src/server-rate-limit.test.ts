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
    'app.get("/api/settings/hue", {',
    'app.post("/api/settings/hue/discover", {',
    'app.put<{Body:unknown}>("/api/settings/hue", {',
    'app.post<{Body:unknown}>("/api/settings/hue/pair", {',
    'app.delete("/api/settings/hue", {',
    'app.get("/api/settings/openccu", {',
    'app.put<{ Body: unknown }>("/api/settings/openccu", {',
    'app.post<{ Body: unknown }>("/api/settings/openccu/diagnose", {',
    'app.delete("/api/settings/openccu", {',
    'app.post("/api/adapters/openccu/reconcile", {',
    'app.post<{ Body: unknown }>("/api/adapters/virtual/devices", {',
    'app.get("/api/automations", {',
    'app.post<{ Body: unknown }>("/api/automations", {',
    'app.put<{ Params: { id: string }; Body: unknown }>("/api/automations/:id", {',
    'app.patch<{ Params: { id: string }; Body: unknown }>("/api/automations/:id/enabled", {',
    'app.delete<{ Params: { id: string } }>("/api/automations/:id", {',
    'app.post<{ Params: { id: string }; Body: unknown }>("/api/devices/:id/command", {',
    'app.get("/api/system/climate-mode", {',
    'app.put<{ Body: unknown }>("/api/system/climate-mode", {',
    'app.get("/api/system/vacation-mode", {',
    'app.put<{ Body: unknown }>("/api/system/vacation-mode", {',
    'app.get("/api/settings/climate-mode", {',
    'app.put<{ Body: unknown }>("/api/settings/climate-mode", {',
    'app.get("/api/settings/general", {',
    'app.put<{ Body: unknown }>("/api/settings/general", {',
    'app.get("/api/settings/appearance", {',
    'app.put<{ Body: unknown }>("/api/settings/appearance", {',
    'app.get("/api/settings/notifications", {',
    'app.put<{ Body: unknown }>("/api/settings/notifications", {',
    'app.post("/api/settings/notifications/test", {',
    'app.post<{ Body: unknown }>("/api/settings/disaster-recovery-backup", {',
    'app.post<{ Body: unknown }>("/api/settings/disaster-recovery-backup/import", {',
    'app.get("/api/commands", {',
    'app.get<{ Querystring: unknown }>("/api/logs", {',
    'app.delete("/api/logs", {'
  ])("adds an explicit per-route limit to %s", routeDeclaration => {
    const start = source.indexOf(routeDeclaration);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(source.slice(start, start + 280)).toContain("config: { rateLimit:");
  });
  it("limits bridge pairing and reconciliation as expensive operations", () => {
    for (const path of [
      '/api/adapters/phoscon/reconcile',
      '/api/adapters/hue/reconcile',
      '/api/settings/hue/discover',
      '/api/adapters/openccu/reconcile',
      '/api/settings/phoscon/pair',
      '/api/settings/hue/pair',
    ]) expect(source).toContain(path);
    expect(source).toContain('security.consumeRateLimit(`reconcile:${ip}`, 12, rateWindowMs)');
    expect(source).toContain('security.consumeRateLimit(`bridge-pairing:${ip}`, 5, rateWindowMs)');
  });

});
