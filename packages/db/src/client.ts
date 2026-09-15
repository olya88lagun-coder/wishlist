import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Database } from "./types";

const DEFAULT_MAX_CONNECTIONS = 5;

export function createDb(databaseUrl: string, options: { maxConnections?: number } = {}): Database {
  const client = postgres(databaseUrl, { max: options.maxConnections ?? DEFAULT_MAX_CONNECTIONS });
  return drizzle(client, { schema }) as unknown as Database;
}
