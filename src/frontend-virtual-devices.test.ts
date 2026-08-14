import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const homekit = readFileSync(new URL("./homekit.ts", import.meta.url), "utf8");
const homekitAst = ts.createSourceFile("homekit.ts", homekit, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function hasInjectedCommander(): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isClassDeclaration(node) && node.name?.text === "HomeKitBridge") {
      const constructor = node.members.find(ts.isConstructorDeclaration);
      found = constructor?.parameters.some(parameter =>
        ts.isIdentifier(parameter.name) &&
        parameter.name.text === "commander" &&
        parameter.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword) === true
      ) ?? false;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(homekitAst);
  return found;
}

function routesHomeKitWritesThroughCommander(): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression;
      if (
        method.name.text === "command" &&
        ts.isPropertyAccessExpression(method.expression) &&
        method.expression.name.text === "commander" &&
        method.expression.expression.kind === ts.SyntaxKind.ThisKeyword
      ) {
        const payload = node.arguments[0];
        if (payload && ts.isObjectLiteralExpression(payload)) {
          const properties = new Map<string, ts.Expression>();
          for (const property of payload.properties) {
            if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
              properties.set(property.name.text, property.initializer);
            }
          }
          const deviceId = properties.get("deviceId");
          const source = properties.get("source");
          found = Boolean(
            deviceId &&
            ts.isPropertyAccessExpression(deviceId) &&
            deviceId.name.text === "id" &&
            source &&
            ts.isStringLiteral(source) &&
            source.text === "homekit"
          );
          if (found) return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(homekitAst);
  return found;
}

describe("virtual device frontend", () => {
  it("adds the virtual-device navigation directly after HomeMatic", () => {
    expect(html.indexOf('data-nav="virtual"')).toBeGreaterThan(html.indexOf('data-nav="openccu"'));
    expect(html).toContain('data-page="virtual"');
    expect(html).toContain('id="addVirtualDeviceDialog"');
  });

  it("renders and creates virtual switches through the shared device UI", () => {
    expect(app).toContain("renderDeviceGrid('virtual',virtualGrid,virtualFilter,virtualRoomFilter)");
    expect(app).toContain("api('/api/adapters/virtual/devices'");
    expect(app).toContain("virtual:'Virtuell'");
  });

  it("routes HomeKit writes through the shared command dispatcher", () => {
    expect(hasInjectedCommander()).toBe(true);
    expect(routesHomeKitWritesThroughCommander()).toBe(true);
  });
});
