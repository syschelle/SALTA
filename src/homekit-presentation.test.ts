import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./homekit.ts", import.meta.url), "utf8");
const databaseSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("homekit.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function callTexts(): string[] {
  const calls: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) calls.push(node.getText(ast));
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return calls;
}

function classMethodNames(className: string): string[] {
  let result: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name?.text === className) {
      result = node.members.filter(ts.isMethodDeclaration).map(member => member.name.getText(ast));
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return result;
}

const calls = callTexts();

describe("HomeKit bridge structure", () => {
  it("maps supported device classes to dedicated HAP services", () => {
    for (const service of [
      "Outlet", "Switch", "Lightbulb", "Fanv2", "WindowCovering", "Thermostat", "MotionSensor", "ContactSensor",
      "TemperatureSensor", "HumiditySensor", "LightSensor", "LeakSensor", "SmokeSensor"
    ]) {
      expect(calls.some(call => call.includes(`addService(Service.${service}`)), `missing Service.${service}`).toBe(true);
    }
  });

  it("supports live bridge configuration, status and pairing reset", () => {
    const methods = classMethodNames("HomeKitBridge");
    expect(methods).toEqual(expect.arrayContaining(["start", "stop", "configure", "status", "resetPairing"]));
    expect(calls.some(call => call.includes("bridge.publish("))).toBe(true);
    expect(calls.some(call => call.includes("bridge.unpublish("))).toBe(true);
    expect(calls.some(call => call.includes("cleanupAccessoryData("))).toBe(true);
  });

  it("enforces per-device publication and optional HomeKit names", () => {
    expect(source).toMatch(/device\.homekitEnabled/);
    expect(source).toMatch(/device\.hidden/);
    expect(source).toMatch(/isHomeKitSupportedDevice\(device\)/);
    expect(source).toMatch(/homeKitAccessoryName\(device\)/);
  });

  it("persists additive per-device publication settings and target-room metadata", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS device_homekit_settings");
    expect(databaseSource).toContain('COALESCE(hk.enabled,d.homekit_enabled) as "homekitEnabled"');
    expect(databaseSource).toContain('COALESCE(hk.use_salta_room,true) as "homekitUseSaltaRoom"');
    expect(databaseSource).toContain('as "homekitRoom"');
  });
});
