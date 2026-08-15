import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adapter = readFileSync(new URL("./hue-adapter.ts", import.meta.url), "utf8");

describe("Philips Hue v2 event stream", () => {
  it("subscribes to the local v2 SSE event stream with the application key header and verified Hue TLS options", () => {
    expect(adapter).toContain("/eventstream/clip/v2");
    expect(adapter).toContain('Accept: "text/event-stream"');
    expect(adapter).toContain('"hue-application-key": applicationKey');
    expect(adapter).toContain("hueHttpsRequestOptions(url.toString(), { bridgeId })");
    expect(adapter).not.toContain("rejectUnauthorized: false");
  });

  it("accepts CRLF and LF event-frame boundaries and coalesces them into a fast reconcile", () => {
    expect(adapter).toContain('chunk.replace(/\\r\\n/g, "\\n")');
    expect(adapter).toContain('buffer.indexOf("\\n\\n")');
    expect(adapter).toContain("this.scheduleReconcileFromEvent()");
  });

  it("keeps a periodic reconciliation fallback when realtime delivery is unavailable", () => {
    expect(adapter).toContain("const pollIntervalMs = 15_000");
    expect(adapter).toContain("setInterval(() => void this.reconcile()");
    expect(adapter).toContain("scheduleReconnect");
  });
});
