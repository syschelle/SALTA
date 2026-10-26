import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  overrides?: Record<string, unknown>;
};

type LockEntry = {
  version?: string;
  resolved?: string;
  integrity?: string;
  dependencies?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, LockEntry>;
};

const readPackageFiles = () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as PackageJson;
  const packageLock = JSON.parse(
    readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
  ) as PackageLock;
  return { packageJson, packageLock };
};

const versionAtLeast = (value: string | undefined, minimum: string) => {
  const parse = (version: string | undefined) =>
    /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? "")?.slice(1).map(Number);
  const actual = parse(value);
  const floor = parse(minimum);
  if (!actual || !floor) return false;
  for (let index = 0; index < 3; index += 1) {
    if (actual[index] > floor[index]) return true;
    if (actual[index] < floor[index]) return false;
  }
  return true;
};

const matchingEntries = (packageLock: PackageLock, dependency: string) => {
  const suffix = `/node_modules/${dependency}`;
  return Object.entries(packageLock.packages ?? {}).filter(
    ([path]) => path === `node_modules/${dependency}` || path.endsWith(suffix),
  );
};

describe("dependency security and reproducibility", () => {
  it("locks find-my-way to the patched HTTP/2 DoS release", () => {
    const { packageJson, packageLock } = readPackageFiles();

    expect(packageJson.overrides?.["find-my-way"]).toBe("9.7.0");

    const entries = matchingEntries(packageLock, "find-my-way");
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.map(([, entry]) => entry.version)).toEqual(
      entries.map(() => "9.7.0"),
    );
  });

  it("keeps the Homebridge DBus lock entry internally consistent", () => {
    const { packageJson, packageLock } = readPackageFiles();

    expect(packageJson.overrides?.["@homebridge/dbus-native"]).toBe("0.7.7");

    const dbus = packageLock.packages?.["node_modules/@homebridge/dbus-native"];
    expect(dbus).toMatchObject({
      version: "0.7.7",
      resolved:
        "https://registry.npmjs.org/@homebridge/dbus-native/-/dbus-native-0.7.7.tgz",
      integrity:
        "sha512-VwTSCy1qofS0QLHtOiSVVmtR49xr/DR17D+5VeJm+xw1rGaluv++MF/atF1Jomxsf4WduVed63ouX2s6SH17Qw==",
    });

    const hap = packageLock.packages?.["node_modules/@homebridge/hap-nodejs"];
    expect(hap?.dependencies?.["@homebridge/dbus-native"]).toBe("^0.7.7");
  });

  it("keeps Fastify and fast-uri above the October 2026 security floors", () => {
    const { packageJson, packageLock } = readPackageFiles();

    expect(packageJson.dependencies?.fastify).toBe("^5.12.6");
    const fastifyEntries = matchingEntries(packageLock, "fastify");
    expect(fastifyEntries.length).toBeGreaterThan(0);
    for (const [, entry] of fastifyEntries) {
      expect(versionAtLeast(entry.version, "5.12.6")).toBe(true);
    }

    const fastUriEntries = matchingEntries(packageLock, "fast-uri");
    expect(fastUriEntries.length).toBeGreaterThan(0);
    for (const [, entry] of fastUriEntries) {
      const major = Number(entry.version?.split(".")[0]);
      if (major === 3) expect(versionAtLeast(entry.version, "3.1.9")).toBe(true);
      if (major === 4) expect(versionAtLeast(entry.version, "4.2.3")).toBe(true);
    }
  });

  it("keeps the Vitest toolchain on the patched 4.1.12 line", () => {
    const { packageJson, packageLock } = readPackageFiles();

    expect(packageJson.devDependencies?.vitest).toBe("^4.1.12");
    for (const dependency of ["vitest", "@vitest/mocker"]) {
      const entries = matchingEntries(packageLock, dependency);
      expect(entries.length).toBeGreaterThan(0);
      for (const [, entry] of entries) {
        expect(versionAtLeast(entry.version, "4.1.12")).toBe(true);
      }
    }
  });

  it("keeps Zod on the patched 4.6.6 release line", () => {
    const { packageJson, packageLock } = readPackageFiles();

    expect(packageJson.dependencies?.zod).toBe("^4.6.6");
    const entries = matchingEntries(packageLock, "zod");
    expect(entries.length).toBeGreaterThan(0);
    for (const [, entry] of entries) {
      expect(versionAtLeast(entry.version, "4.6.6")).toBe(true);
    }
  });

  it("removes vulnerable Tinypool releases and patches source-map-js", () => {
    const { packageLock } = readPackageFiles();

    for (const [, entry] of matchingEntries(packageLock, "tinypool")) {
      expect(versionAtLeast(entry.version, "2.1.2")).toBe(true);
    }

    const sourceMapEntries = matchingEntries(packageLock, "source-map-js");
    expect(sourceMapEntries.length).toBeGreaterThan(0);
    for (const [, entry] of sourceMapEntries) {
      expect(versionAtLeast(entry.version, "1.2.2")).toBe(true);
    }
  });
});
