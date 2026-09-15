import { createDb, type Database } from "@wishlist/db";
import { getEnv } from "./env";

let db: Database | null = null;
export function getDb(): Database {
  // Локальная PGlite-БД обслуживает одно соединение: DATABASE_POOL_MAX=1 в .env.development.local
  const maxConnections = process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : undefined;
  db ??= createDb(getEnv().DATABASE_URL, { maxConnections });
  return db;
}
