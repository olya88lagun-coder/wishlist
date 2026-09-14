import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Database } from "./types";

const MAX_CONNECTIONS = 5;

export function createDb(databaseUrl: string): Database {
  const client = postgres(databaseUrl, { max: MAX_CONNECTIONS });
  return drizzle(client, { schema }) as unknown as Database;
}
