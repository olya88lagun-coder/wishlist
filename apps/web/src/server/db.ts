import { createDb, type Database } from "@wishlist/db";
import { getEnv } from "./env";

// Route handlers и страницы Next собираются в разные бандлы, а HMR перезагружает модули:
// храним пул в globalThis, чтобы на процесс было ровно одно подключение
const holder = globalThis as typeof globalThis & { __wishlistDb?: Database };

export function getDb(): Database {
  // Локальная PGlite-БД обслуживает одно соединение: DATABASE_POOL_MAX=1 в .env.development.local
  const maxConnections = process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : undefined;
  holder.__wishlistDb ??= createDb(getEnv().DATABASE_URL, { maxConnections });
  return holder.__wishlistDb;
}
