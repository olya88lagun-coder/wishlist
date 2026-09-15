import { z } from "zod";

const S3_REQUIRED = ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_IMAGES_BUCKET", "S3_BACKUPS_BUCKET"] as const;

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.url().default("https://s3.twcstorage.ru"),
  S3_REGION: z.string().min(1).default("ru-1"),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_IMAGES_BUCKET: z.string().min(1).optional(),
  S3_BACKUPS_BUCKET: z.string().min(1).optional(),
});

export type WorkerEnv = {
  DATABASE_URL: string;
  s3: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; imagesBucket: string; backupsBucket: string } | null;
};

export function readWorkerEnv(source: Record<string, string | undefined> = process.env): WorkerEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) throw new Error(`Invalid environment variables: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  const env = parsed.data;
  const missing = S3_REQUIRED.filter((name) => !env[name]);
  if (missing.length === S3_REQUIRED.length) return { DATABASE_URL: env.DATABASE_URL, s3: null };
  if (missing.length > 0) throw new Error(`Incomplete S3 configuration, missing: ${missing.join(", ")}`);
  return {
    DATABASE_URL: env.DATABASE_URL,
    s3: {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      imagesBucket: env.S3_IMAGES_BUCKET!,
      backupsBucket: env.S3_BACKUPS_BUCKET!,
    },
  };
}
