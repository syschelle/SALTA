import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const databaseSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("./server.ts", import.meta.url), "utf8");

describe("bounded command history", () => {
  it("prunes command history to 90 days and at most 10000 newest rows", () => {
    expect(databaseSource.match(/DELETE FROM commands WHERE created_at < now\(\) - interval '90 days'/g) ?? []).toHaveLength(2);
    expect(databaseSource.match(/ORDER BY created_at DESC, id DESC OFFSET 10000/g) ?? []).toHaveLength(2);
    expect(databaseSource).toContain("export async function pruneCommandHistory(): Promise<void>");
  });

  it("runs retention after each newly persisted API command without making cleanup part of command success", () => {
    const insertAt = serverSource.indexOf('insert into commands(id,device_id,capability,value,source,status)');
    const pruneAt = serverSource.indexOf("await pruneCommandHistory().catch(() => undefined)");
    expect(insertAt).toBeGreaterThanOrEqual(0);
    expect(pruneAt).toBeGreaterThan(insertAt);
    expect(serverSource).toContain("listSystemLogs, pool, pruneCommandHistory, reorderRooms");
  });
});
