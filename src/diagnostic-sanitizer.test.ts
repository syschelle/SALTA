import { describe, expect, it } from "vitest";
import { assertDiagnosticDoesNotContainSecrets, diagnosticFieldIsSecret, sanitizeDiagnosticValue } from "./diagnostic-sanitizer.js";

describe("sanitized diagnostic export", () => {
  it("removes credentials and secrets without stripping diagnostic data-point keys", () => {
    const sanitized = sanitizeDiagnosticValue({
      username: "admin",
      password: "secret-password",
      apiKey: "api-key-value",
      applicationKey: "application-key-value",
      userKey: "user-key-value",
      sessionId: "session-value",
      pin: "031-45-154",
      setupUri: "X-HM://secret",
      credentialUsername: "device-user",
      stateKey: "winterActive",
      valueKey: "SET_TEMPERATURE",
      targetTemperatureParameter: "SET_TEMPERATURE",
      baseUrl: "https://diagnostic-user:diagnostic-pass@example.test:49443/",
      adapterData: {
        channelAddress: "MEQ0004123:2",
        interfaceName: "BidCos-RF",
        encrypted_password: "v2.0123456789abcdefghijklmnop"
      }
    }) as Record<string, unknown>;

    expect(sanitized).not.toHaveProperty("username");
    expect(sanitized).not.toHaveProperty("password");
    expect(sanitized).not.toHaveProperty("apiKey");
    expect(sanitized).not.toHaveProperty("applicationKey");
    expect(sanitized).not.toHaveProperty("userKey");
    expect(sanitized).not.toHaveProperty("sessionId");
    expect(sanitized).not.toHaveProperty("pin");
    expect(sanitized).not.toHaveProperty("setupUri");
    expect(sanitized).not.toHaveProperty("credentialUsername");
    expect(sanitized.stateKey).toBe("winterActive");
    expect(sanitized.valueKey).toBe("SET_TEMPERATURE");
    expect(sanitized.targetTemperatureParameter).toBe("SET_TEMPERATURE");
    expect(sanitized.baseUrl).toBe("https://example.test:49443/");
    expect(sanitized.adapterData).toEqual({ channelAddress: "MEQ0004123:2", interfaceName: "BidCos-RF" });
  });

  it("recognizes camelCase and snake_case secret fields while preserving ordinary *Key diagnostics", () => {
    for (const key of ["password", "encrypted_password", "apiKey", "application_key", "userKey", "sessionToken", "credentialUsername"]) {
      expect(diagnosticFieldIsSecret(key)).toBe(true);
    }
    for (const key of ["stateKey", "valueKey", "targetTemperatureParameter", "channelAddress"]) {
      expect(diagnosticFieldIsSecret(key)).toBe(false);
    }
  });

  it("fails closed when a known plaintext secret appears anywhere in the final export", () => {
    expect(() => assertDiagnosticDoesNotContainSecrets({ details: { harmless: "ok" } }, ["super-secret-123"])).not.toThrow();
    expect(() => assertDiagnosticDoesNotContainSecrets({ details: { note: "contains super-secret-123 here" } }, ["super-secret-123"]))
      .toThrow("DIAGNOSTIC_EXPORT_SECRET_GUARD");
  });
});
