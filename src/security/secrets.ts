import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { config } from "../config.js";

const KEY_LENGTH = 32;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const DERIVED_KEY_CACHE_LIMIT = 256;
const derivedKeyCache = new Map<string, Buffer>();

function derivedKey(salt: Buffer): Buffer {
  const cacheId = createHash("sha256").update(config.SALTA_ENCRYPTION_KEY, "utf8").update(salt).digest("base64url");
  const cached = derivedKeyCache.get(cacheId);
  if (cached) return cached;
  const result = scryptSync(config.SALTA_ENCRYPTION_KEY, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  if (derivedKeyCache.size >= DERIVED_KEY_CACHE_LIMIT) {
    const oldest = derivedKeyCache.keys().next().value as string | undefined;
    if (oldest) derivedKeyCache.delete(oldest);
  }
  derivedKeyCache.set(cacheId, result);
  return result;
}

function decryptGcm(key: Buffer, ivValue: string, tagValue: string, encryptedValue: string): string {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptSecret(value: string): string {
  if (!value) return "";
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey(salt), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v2", salt.toString("base64url"), iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string): string {
  if (!value) return "";
  try {
    const parts = value.split(".");
    if (parts[0] === "v2") {
      const [, saltValue, ivValue, tagValue, encryptedValue] = parts;
      if (!saltValue || !ivValue || !tagValue || !encryptedValue) throw new Error("INVALID_ENCRYPTED_SECRET");
      return decryptGcm(derivedKey(Buffer.from(saltValue, "base64url")), ivValue, tagValue, encryptedValue);
    }
    throw new Error("INVALID_ENCRYPTED_SECRET");
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_ENCRYPTED_SECRET") throw error;
    throw new Error("ENCRYPTION_KEY_MISMATCH", { cause: error });
  }
}
