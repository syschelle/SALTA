import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

describe("FRITZ!Box Smart Home upgrade safety", () => {
  it("keeps the existing database schema version and stores opt-in state in notification_state", () => {
    expect(db).toContain('export const DATABASE_SCHEMA_VERSION = "0.5"');
    expect(db).toContain("WHERE key='fritzbox-smarthome-settings'");
    expect(db).toContain("VALUES('fritzbox-smarthome-settings',$1::jsonb,now())");
    expect(db).not.toContain("CREATE TABLE IF NOT EXISTS fritzbox_smarthome");
  });

  it("defaults every Smart Home import switch to false", () => {
    expect(db).toContain('enabled: details?.enabled === true');
    expect(db).toContain('thermostats: details?.thermostats === true');
    expect(db).toContain('outlets: details?.outlets === true');
    expect(db).toContain('lights: details?.lights === true');
    expect(db).toContain('sensors: details?.sensors === true');
  });

  it("registers FRITZ!Box Smart Home as an independent adapter source", () => {
    expect(main).toContain('const fritzSmartHome = new FritzBoxSmartHomeAdapter(registry);');
    expect(main).toContain('fritzbox: fritzSmartHome');
    expect(main).toContain('registerFritzBoxSmartHomeRoutes(server, fritzSmartHome);');
  });
});
