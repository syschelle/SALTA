import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionCallsWithStringArgument, hasFunction } from "../test-utils/source-inspection.js";
import { cssMediaRuleContains, cssRuleContains } from "../test-utils/style-inspection.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("disaster recovery backup frontend", () => {
  it("offers password protected full backup export and recovery import", () => {
    expect(html).toContain('data-settings-panel="backup"');
    expect(html).toContain('data-settings-content="backup"');
    expect(html).toContain('id="recoveryBackupExportPassword"');
    expect(html).toContain('id="recoveryBackupExportPasswordConfirm"');
    expect(html).toContain('id="recoveryBackupExportButton"');
    expect(html).toContain('id="recoveryBackupFile"');
    expect(html).toContain('id="recoveryBackupImportPassword"');
    expect(html).toContain('id="recoveryBackupImportButton"');
    expect(html).toContain("HomeKit-Pairing-Status");
    expect(hasFunction(app, "exportDisasterRecoveryBackup")).toBe(true);
    expect(hasFunction(app, "importDisasterRecoveryBackupFile")).toBe(true);
    expect(functionCallsWithStringArgument(app, "exportDisasterRecoveryBackup", "api", "/api/settings/disaster-recovery-backup")).toBe(true);
    expect(functionCallsWithStringArgument(app, "importDisasterRecoveryBackupFile", "api", "/api/settings/disaster-recovery-backup/import")).toBe(true);
  });

  it("keeps the recovery UI responsive", () => {
    expect(cssRuleContains(styles, ".configuration-backup-grid", "grid-template-columns:1fr 1fr")).toBe(true);
    expect(cssRuleContains(styles, ".configuration-backup-passwords", "grid-template-columns:1fr 1fr")).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:760px)", ".configuration-backup-grid", "grid-template-columns:1fr")).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:760px)", ".configuration-backup-passwords", "grid-template-columns:1fr")).toBe(true);
  });
});
