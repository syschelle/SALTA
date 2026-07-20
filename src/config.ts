import { z } from "zod";

const booleanFromString = z.string().default("false").transform((value) => value.toLowerCase() === "true");

const schema = z.object({
  WEB_HOST: z.string().default("0.0.0.0"),
  WEB_PORT: z.coerce.number().int().min(1).max(65535).default(8099),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().default(""),
  HOMEKIT_ENABLED: booleanFromString,
  HOMEKIT_NAME: z.string().default("SALTA Bridge"),
  HOMEKIT_PIN: z.string().regex(/^\d{3}-\d{2}-\d{3}$/).default("031-45-154"),
  HOMEKIT_PORT: z.coerce.number().int().min(1).max(65535).default(51826),
  HOMEKIT_USERNAME: z.string().regex(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i).default("02:42:53:41:4C:54"),
  SALTA_ENCRYPTION_KEY: z.string().min(16).default("change-this-local-encryption-key")
});

export type AppConfig = z.infer<typeof schema>;
export const config = schema.parse(process.env);
