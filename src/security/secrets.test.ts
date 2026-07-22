import { describe, expect, it, vi } from "vitest";

vi.mock("../config.js", () => ({
  config: { SALTA_ENCRYPTION_KEY: "test-encryption-key-that-is-long-enough" }
}));

import { config } from "../config.js";
import { decryptSecret, encryptSecret } from "./secrets.js";

describe("secret encryption", () => {
  it("encrypts new values with AES-256-GCM and a scrypt-derived key", () => {
    const encrypted = encryptSecret("shelly-password");
    expect(encrypted.startsWith("v2.")).toBe(true);
    expect(decryptSecret(encrypted)).toBe("shelly-password");
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
