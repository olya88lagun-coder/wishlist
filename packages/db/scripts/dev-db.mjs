// Локальная Postgres-совместимая БД для `next dev`: PGlite с данными в .dev-db/ и миграциями
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const DEV_DB_PORT = 5433;
const dataDir = fileURLToPath(new URL("../../../.dev-db", import.meta.url));
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

const db = await PGlite.create(dataDir);
await migrate(drizzle(db), { migrationsFolder });
// web (postgres.js + отправка в pg-boss) и воркер (postgres.js + pg-boss) держат до ~8 соединений; PGlite выполняет запросы по очереди
const server = new PGLiteSocketServer({ db, port: DEV_DB_PORT, host: "127.0.0.1", maxConnections: 10 });
await server.start();
console.log(`dev db ready: postgres://postgres:postgres@127.0.0.1:${DEV_DB_PORT}/postgres`);

process.on("SIGINT", async () => {
  await server.stop();
  await db.close();
  process.exit(0);
});
