import { describe, expect, it } from "vitest";
import type { SystemLogEntry } from "./types.js";
import { collapseSystemLogEntries, normalizeSystemLogSettings, systemLogEntryMatchesHiddenPatterns } from "./system-log-policy.js";

const entry = (createdAt: string, overrides: Partial<SystemLogEntry> = {}): SystemLogEntry => ({
  id: createdAt,
  level: "warning",
  source: "openccu",
  code: "OPENCCU_CHANNEL_READ_PARTIAL",
  message: "Some OpenCCU channels could not be read",
  details: { failedChannels: 4, catalogChannels: 84 },
  createdAt,
  ...overrides
});

describe("system log policy", () => {
  it("normalizes configurable repeat and hidden-pattern settings", () => {
    expect(normalizeSystemLogSettings({ collapseRepeats: false, repeatWindowMinutes: 30, hiddenPatterns: [" OPENCCU ", "openccu", "", 42] })).toEqual({
      collapseRepeats: false,
      repeatWindowMinutes: 30,
      hiddenPatterns: ["OPENCCU"]
    });
    expect(normalizeSystemLogSettings({})).toEqual({ collapseRepeats: true, repeatWindowMinutes: 15, hiddenPatterns: [] });
  });

  it("matches hidden patterns case-insensitively against source, code, and message", () => {
    const sample = entry("2026-10-13T07:05:16.535Z");
    expect(systemLogEntryMatchesHiddenPatterns(sample, ["channel_read_partial"])).toBe(true);
    expect(systemLogEntryMatchesHiddenPatterns(sample, ["some openccu channels"])).toBe(true);
    expect(systemLogEntryMatchesHiddenPatterns(sample, ["phoscon"])).toBe(false);
  });

  it("collapses continuous identical messages while keeping separate later episodes", () => {
    const collapsed = collapseSystemLogEntries([
      entry("2026-10-13T07:00:00.000Z"),
      entry("2026-10-13T07:01:00.000Z"),
      entry("2026-10-13T07:02:00.000Z"),
      entry("2026-10-13T07:30:00.000Z")
    ], 15);
    expect(collapsed).toHaveLength(2);
    expect(collapsed[0]?.createdAt).toBe("2026-10-13T07:30:00.000Z");
    expect(collapsed[1]?.details._repeat).toMatchObject({ count: 3, firstSeenAt: "2026-10-13T07:00:00.000Z", lastSeenAt: "2026-10-13T07:02:00.000Z" });
  });
});
