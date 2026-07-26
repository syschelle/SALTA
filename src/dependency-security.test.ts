import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PackageJson = {
  overrides?: Record<string, string>;
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

describe("dependency security and reproducibility", () => {
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

  it("keeps the Homebridge DBus lock entry internally consistent", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as PackageJson;
    const packageLock = JSON.parse(
      readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
    ) as PackageLock;

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
});
