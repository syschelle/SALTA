import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./homekit.ts", import.meta.url), "utf8");
const databaseSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

describe("HomeKit device presentation", () => {
  it("maps relay roles to dedicated HomeKit services", () => {
    expect(source).toContain('case "light": s=a.addService(Service.Lightbulb');
    expect(source).toContain('case "switch": s=a.addService(Service.Switch');
    expect(source).toContain('case "outlet": s=a.addService(Service.Outlet');
    expect(source).toContain('case "fan": s=a.addService(Service.Fanv2');
    expect(source).toContain("Characteristic.Active");
  });


  it("removes hidden devices from HomeKit", () => {
    expect(source).toContain("if(!d.homekitEnabled || d.hidden || !isHomeKitSupportedDevice(d)){ this.remove(d.id); return; }");
  });

  it("persists the selected presentation type", () => {
    expect(databaseSource).toContain("presentation_type text NOT NULL DEFAULT 'auto'");
    expect(databaseSource).toContain('d.presentation_type as "presentationType"');
  });
  it("uses the optional HomeKit name override and does not coerce unsupported sensors into switches", () => {
    expect(source).toContain("const accessoryName=homeKitAccessoryName(d)");
    expect(source).toContain("a=new Accessory(accessoryName");
    expect(source).toContain("default: return;");
  });

  it("loads additive HomeKit publication settings and target-room metadata", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS device_homekit_settings");
    expect(databaseSource).toContain('COALESCE(hk.enabled,d.homekit_enabled) as "homekitEnabled"');
    expect(databaseSource).toContain('COALESCE(hk.use_salta_room,true) as "homekitUseSaltaRoom"');
    expect(databaseSource).toContain('as "homekitRoom"');
  });

});
