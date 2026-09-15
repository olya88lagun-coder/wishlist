import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";

export const BACKUP_PREFIX = "db/";
export const BACKUP_KEEP_DAYS = 14;
export const MAX_BACKUP_BYTES = 200 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^db\/wishlist-(\d{4}-\d{2}-\d{2})T[\d-]+Z\.sql\.gz$/;
const STDERR_TAIL = 2000;

export function backupKey(now: Date): string {
  return `${BACKUP_PREFIX}wishlist-${now.toISOString().replace(/[:.]/g, "-")}.sql.gz`;
}

export function expiredBackupKeys(keys: string[], now: Date, keepDays = BACKUP_KEEP_DAYS): string[] {
  const cutoff = now.getTime() - keepDays * DAY_MS;
  return keys.filter((key) => {
    const day = KEY_PATTERN.exec(key)?.[1];
    return day !== undefined && new Date(`${day}T00:00:00.000Z`).getTime() < cutoff;
  });
}

export function pgEnvFromUrl(databaseUrl: string): Record<"PGHOST" | "PGPORT" | "PGUSER" | "PGPASSWORD" | "PGDATABASE", string> {
  const url = new URL(databaseUrl);
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")),
  };
}

export function dumpDatabase(databaseUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("pg_dump", ["--no-owner", "--no-privileges"], {
      env: { ...process.env, ...pgEnvFromUrl(databaseUrl) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const gzip = createGzip();
    const chunks: Buffer[] = [];
    let size = 0;
    let stderr = "";
    let exitCode: number | null | undefined;
    let compressed = false;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(error);
    };
    // Готово, только когда и pg_dump завершился успешно, и gzip выдал последний блок — порядок этих событий не гарантирован
    const finishIfDone = () => {
      if (settled || exitCode === undefined || !compressed) return;
      settled = true;
      if (exitCode !== 0) reject(new Error(`pg_dump exited with ${exitCode}: ${stderr.trim()}`));
      else resolve(Buffer.concat(chunks));
    };

    child.stdout.pipe(gzip);
    gzip.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BACKUP_BYTES) return fail(new Error(`backup is larger than ${MAX_BACKUP_BYTES} bytes`));
      chunks.push(chunk);
    });
    gzip.on("end", () => {
      compressed = true;
      finishIfDone();
    });
    gzip.on("error", fail);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-STDERR_TAIL);
    });
    child.on("error", fail);
    child.on("close", (code) => {
      exitCode = code;
      finishIfDone();
    });
  });
}
