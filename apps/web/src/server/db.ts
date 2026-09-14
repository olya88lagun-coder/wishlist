import { createDb, type Database } from "@wishlist/db";
import { getEnv } from "./env";

let db: Database | null = null;
export function getDb(): Database {
  db ??= createDb(getEnv().DATABASE_URL);
  return db;
}
