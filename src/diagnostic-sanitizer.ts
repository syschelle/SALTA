const secretFieldNames = new Set([
  "username",
  "password",
  "passwd",
  "secret",
  "token",
  "apikey",
  "applicationkey",
  "userkey",
  "sessionid",
  "sessiontoken",
  "pin",
  "setupuri",
  "authorization",
  "cookie",
  "credentialpassword",
  "credentialusername",
  "encryptedpassword",
  "encryptedapikey",
  "encryptedapplicationkey",
  "encrypteduserkey",
  "encryptedapitoken"
]);

function normalizedFieldName(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function diagnosticFieldIsSecret(fieldName: string): boolean {
  const normalized = normalizedFieldName(fieldName);
  if (secretFieldNames.has(normalized)) return true;
  return normalized.endsWith("password")
    || normalized.endsWith("token")
    || normalized.endsWith("apikey")
    || normalized.endsWith("applicationkey")
    || normalized.endsWith("userkey")
    || normalized.endsWith("sessionid");
}

export function sanitizeDiagnosticValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => sanitizeDiagnosticValue(item));
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (value === null || typeof value !== "object") {
    if (typeof value === "string") {
      if (/^v\d+\.[A-Za-z0-9_-]{16,}/.test(value)) return "[redacted-encrypted-secret]";
      if (/^https?:\/\//i.test(value)) {
        try {
          const url = new URL(value);
          if (url.username || url.password) {
            url.username = "";
            url.password = "";
            return url.toString();
          }
        } catch {
          // Keep malformed non-secret diagnostic strings unchanged.
        }
      }
    }
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (diagnosticFieldIsSecret(key)) continue;
    output[key] = sanitizeDiagnosticValue(nested);
  }
  return output;
}

export function assertDiagnosticDoesNotContainSecrets(payload: unknown, secrets: readonly string[]): void {
  const serialized = JSON.stringify(payload);
  for (const secret of secrets) {
    if (secret && serialized.includes(secret)) throw new Error("DIAGNOSTIC_EXPORT_SECRET_GUARD");
  }
}
