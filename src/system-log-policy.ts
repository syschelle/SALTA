import type { SystemLogEntry, SystemLogSettings } from "./types.js";

export const SYSTEM_LOG_REPEAT_META_KEY = "_repeat";
export const DEFAULT_SYSTEM_LOG_SETTINGS: SystemLogSettings = {
  collapseRepeats: true,
  repeatWindowMinutes: 15,
  hiddenPatterns: []
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function normalizedTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function timestampMs(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  const object = asRecord(value);
  if (!object) return value;
  return Object.fromEntries(Object.keys(object).sort().map(key => [key, stableValue(object[key])]));
}

export function normalizeSystemLogSettings(value: unknown): SystemLogSettings {
  const input = asRecord(value);
  const requestedWindow = Number(input?.repeatWindowMinutes);
  const repeatWindowMinutes = Number.isSafeInteger(requestedWindow) && requestedWindow >= 1 && requestedWindow <= 1440
    ? requestedWindow
    : DEFAULT_SYSTEM_LOG_SETTINGS.repeatWindowMinutes;
  const hiddenPatterns: string[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(input?.hiddenPatterns) ? input.hiddenPatterns : []) {
    if (typeof raw !== "string") continue;
    const pattern = raw.trim().slice(0, 120);
    if (!pattern) continue;
    const key = pattern.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hiddenPatterns.push(pattern);
    if (hiddenPatterns.length >= 50) break;
  }
  return {
    collapseRepeats: input?.collapseRepeats !== false,
    repeatWindowMinutes,
    hiddenPatterns
  };
}

export function systemLogBaseDetails(details: Record<string, unknown> = {}): Record<string, unknown> {
  const { [SYSTEM_LOG_REPEAT_META_KEY]: _repeat, ...base } = details;
  void _repeat;
  return base;
}

export function systemLogRepeatMeta(entry: SystemLogEntry): { count: number; firstSeenAt: string; lastSeenAt: string } {
  const raw = asRecord(entry.details?.[SYSTEM_LOG_REPEAT_META_KEY]);
  const requestedCount = Number(raw?.count);
  const count = Number.isSafeInteger(requestedCount) && requestedCount > 1 ? requestedCount : 1;
  const firstSeenAt = normalizedTimestamp(raw?.firstSeenAt, entry.createdAt);
  const lastSeenAt = normalizedTimestamp(raw?.lastSeenAt, entry.createdAt);
  return { count, firstSeenAt, lastSeenAt };
}

export function systemLogEntryMatchesHiddenPatterns(entry: SystemLogEntry, patterns: string[]): boolean {
  if (!patterns.length) return false;
  const searchable = [entry.source, entry.code ?? "", entry.message].join("\n").toLowerCase();
  return patterns.some(pattern => searchable.includes(pattern.trim().toLowerCase()));
}

function systemLogFingerprint(entry: SystemLogEntry): string {
  return JSON.stringify({
    level: entry.level,
    source: entry.source,
    code: entry.code ?? null,
    message: entry.message,
    details: stableValue(systemLogBaseDetails(entry.details))
  });
}

export function collapseSystemLogEntries(entries: SystemLogEntry[], repeatWindowMinutes: number): SystemLogEntry[] {
  if (entries.length < 2) return entries.map(entry => ({ ...entry, details: { ...entry.details } }));
  const windowMs = Math.max(1, Math.min(1440, Math.trunc(repeatWindowMinutes || DEFAULT_SYSTEM_LOG_SETTINGS.repeatWindowMinutes))) * 60_000;
  const ordered = [...entries].sort((a, b) => timestampMs(a.createdAt) - timestampMs(b.createdAt));
  const grouped: SystemLogEntry[] = [];
  const active = new Map<string, { index: number; lastSeenMs: number }>();

  for (const entry of ordered) {
    const key = systemLogFingerprint(entry);
    const meta = systemLogRepeatMeta(entry);
    const firstSeenMs = timestampMs(meta.firstSeenAt) || timestampMs(entry.createdAt);
    const lastSeenMs = timestampMs(meta.lastSeenAt) || timestampMs(entry.createdAt);
    const previous = active.get(key);
    if (previous && firstSeenMs - previous.lastSeenMs <= windowMs) {
      const current = grouped[previous.index]!;
      const currentMeta = systemLogRepeatMeta(current);
      grouped[previous.index] = {
        ...entry,
        createdAt: meta.lastSeenAt,
        details: {
          ...systemLogBaseDetails(entry.details),
          [SYSTEM_LOG_REPEAT_META_KEY]: {
            count: currentMeta.count + meta.count,
            firstSeenAt: currentMeta.firstSeenAt,
            lastSeenAt: meta.lastSeenAt
          }
        }
      };
      active.set(key, { index: previous.index, lastSeenMs });
      continue;
    }

    const details = systemLogBaseDetails(entry.details);
    if (meta.count > 1) details[SYSTEM_LOG_REPEAT_META_KEY] = meta;
    grouped.push({ ...entry, createdAt: meta.lastSeenAt, details });
    active.set(key, { index: grouped.length - 1, lastSeenMs });
  }

  return grouped.sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
}
