import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("../config.js", () => ({
  config: { SALTA_ENCRYPTION_KEY: "test-encryption-key-that-is-long-enough" }
}));

import { config } from "../config.js";
import { decryptSecret, encryptSecret } from "./secrets.js";

function legacyEncrypt(value: string): string {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(config.SALTA_ENCRYPTION_KEY, "utf8").digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

describe("secret encryption", () => {
  it("encrypts new values with AES-256-GCM and a scrypt-derived key", () => {
    const encrypted = encryptSecret("shelly-password");
    expect(encrypted.startsWith("v2.")).toBe(true);
    expect(decryptSecret(encrypted)).toBe("shelly-password");
  });

  it("continues to decrypt legacy v1 secrets", () => {
    expect(decryptSecret(legacyEncrypt("legacy-password"))).toBe("legacy-password");
  });

  it("returns a stable error code for a mismatching encryption key", () => {
    const encrypted = encryptSecret("shelly-password");
    const original = config.SALTA_ENCRYPTION_KEY;
    (config as { SALTA_ENCRYPTION_KEY: string }).SALTA_ENCRYPTION_KEY = "another-encryption-key-that-is-long-enough";
    try {
      expect(() => decryptSecret(encrypted)).toThrowError("ENCRYPTION_KEY_MISMATCH");
    } finally {
      (config as { SALTA_ENCRYPTION_KEY: string }).SALTA_ENCRYPTION_KEY = original;
    }
  });
});
