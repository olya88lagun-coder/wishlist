import { z } from "zod";

const S3_REQUIRED = ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_IMAGES_BUCKET", "S3_BACKUPS_BUCKET"] as const;
const TELEGRAM_REQUIRED = ["APP_URL", "SESSION_SECRET"] as const;

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.url().default("https://s3.twcstorage.ru"),
  S3_REGION: z.string().min(1).default("ru-1"),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_IMAGES_BUCKET: z.string().min(1).optional(),
  S3_BACKUPS_BUCKET: z.string().min(1).optional(),
  S3_PUBLIC_BASE_URL: z.url().optional(),
  TELEGRAM_BOT_TOKEN: z
    .string()
    .regex(/^\d+:[\w-]+$/)
    .optional(),
  APP_URL: z.url().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  ADMIN_TELEGRAM_ID: z
    .string()
    .regex(/^\d+$/)
    .optional(),
});

type ParsedEnv = z.infer<typeof schema>;

export type S3Config = { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; imagesBucket: string; backupsBucket: string };
export type TelegramConfig = { token: string; appUrl: string; sessionSecret: string; adminId: number | null };

export type WorkerEnv = {
  DATABASE_URL: string;
  s3: S3Config | null;
  telegram: TelegramConfig | null;
  imagesPublicBaseUrl: string | null;
};

function readS3(env: ParsedEnv): S3Config | null {
  const missing = S3_REQUIRED.filter((name) => !env[name]);
  if (missing.length === S3_REQUIRED.length) return null;
  if (missing.length > 0) throw new Error(`Incomplete S3 configuration, missing: ${missing.join(", ")}`);
  return {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    imagesBucket: env.S3_IMAGES_BUCKET!,
    backupsBucket: env.S3_BACKUPS_BUCKET!,
  };
}

// Без токена бот выключен; токен без адреса сайта и секрета — ошибка конфигурации
function readTelegram(env: ParsedEnv): TelegramConfig | null {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  const missing = TELEGRAM_REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Incomplete Telegram configuration, missing: ${missing.join(", ")}`);
  return {
    token: env.TELEGRAM_BOT_TOKEN,
    appUrl: env.APP_URL!,
    sessionSecret: env.SESSION_SECRET!,
    adminId: env.ADMIN_TELEGRAM_ID ? Number(env.ADMIN_TELEGRAM_ID) : null,
  };
}

export function readWorkerEnv(source: Record<string, string | undefined> = process.env): WorkerEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) throw new Error(`Invalid environment variables: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  const env = parsed.data;
  return { DATABASE_URL: env.DATABASE_URL, s3: readS3(env), telegram: readTelegram(env), imagesPublicBaseUrl: env.S3_PUBLIC_BASE_URL ?? null };
}
