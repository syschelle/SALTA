// Centralized, non-production environment for tests that intentionally import
// modules backed by the application configuration. Using ??= preserves any
// explicit values provided by an individual test or the CI environment.
process.env.DATABASE_URL ??= "postgres://salta_test:salta_test@127.0.0.1:5432/salta_test";
process.env.ADMIN_PASSWORD ??= "salta-test-admin-password-0123456789";
process.env.SALTA_HEALTH_TOKEN ??= "salta-test-health-token-012345678901234567890123456789";
process.env.SALTA_ENCRYPTION_KEY ??= "salta-test-encryption-key-0123456789";
process.env.LOG_LEVEL ??= "silent";
process.env.HOMEKIT_ENABLED ??= "false";
