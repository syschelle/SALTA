import { z } from "zod";

const booleanFromString = z.string().default("false").transform((value) => value.toLowerCase() === "true");
const nonPlaceholderSecret = (minimum: number, label: string) => z.string().min(minimum).refine(
  value => !/change[_-]?me|change-this|example/i.test(value.trim()),
  `${label} must not use a placeholder value`
);

const schema = z.object({
  WEB_HOST: z.string().default("0.0.0.0"),
  WEB_PORT: z.coerce.number().int().min(1).max(65535).default(8099),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  ADMIN_USERNAME: z.string().trim().min(1).max(64).default("admin"),
  ADMIN_PASSWORD: nonPlaceholderSecret(16, "ADMIN_PASSWORD"),
  SESSION_TTL_MINUTES: z.coerce.number().int().min(15).max(1440).default(720),
  TRUSTED_PROXIES: z.string().default(""),
  LOCAL_NETWORKS: z.string().default("127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,::1/128,fc00::/7,fe80::/10"),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(30).max(10000).default(300),
  RATE_LIMIT_MUTATIONS_PER_MINUTE: z.coerce.number().int().min(5).max(1000).default(60),
  RATE_LIMIT_GLOBAL_PER_MINUTE: z.coerce.number().int().min(100).max(100000).default(3000),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  LOGIN_WINDOW_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  LOGIN_BLOCK_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  SALTA_HEALTH_TOKEN: nonPlaceholderSecret(32, "SALTA_HEALTH_TOKEN"),
  HOMEKIT_ENABLED: booleanFromString,
  HOMEKIT_NAME: z.string().default("SALTA Bridge"),
  HOMEKIT_PIN: z.string().regex(/^\d{3}-\d{2}-\d{3}$/).default("031-45-154"),
  HOMEKIT_PORT: z.coerce.number().int().min(1).max(65535).default(51826),
  HOMEKIT_USERNAME: z.string().regex(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i).default("02:42:53:41:4C:54"),
  SALTA_ENCRYPTION_KEY: nonPlaceholderSecret(16, "SALTA_ENCRYPTION_KEY")
});

export const config = schema.parse(process.env);
