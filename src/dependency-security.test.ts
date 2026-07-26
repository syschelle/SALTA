import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PackageJson = {
  overrides?: Record<string, string>;
};

type LockEntry = {
  version?: string;
};

type PackageLock = {
  packages?: Record<string, LockEntry>;
};

describe("dependency security", () => {
  it("locks find-my-way to the patched HTTP/2 DoS release", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as PackageJson;
    const packageLock = JSON.parse(
      readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
    ) as PackageLock;

    expect(packageJson.overrides?.["find-my-way"]).toBe("9.7.0");

    const entries = Object.entries(packageLock.packages ?? {}).filter(
      ([path]) =>
        path === "node_modules/find-my-way" ||
        path.endsWith("/node_modules/find-my-way"),
    );

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.map(([, entry]) => entry.version)).toEqual(
      entries.map(() => "9.7.0"),
    );
  });
});
