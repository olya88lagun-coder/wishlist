import { PARSE_JOB_OPTIONS, type ParseItemJob, QUEUES } from "@wishlist/core";
import { PgBoss } from "pg-boss";
import { getEnv } from "./env";

const holder = globalThis as typeof globalThis & { __wishlistQueue?: Promise<PgBoss> };

function queue(): Promise<PgBoss> {
  holder.__wishlistQueue ??= (async () => {
    // Только отправка: схему, очереди и расписания создаёт воркер
    const boss = new PgBoss({ connectionString: getEnv().DATABASE_URL, max: 1, supervise: false, schedule: false, migrate: false });
    boss.on("error", (error) => console.error("queue error", String(error)));
    await boss.start();
    return boss;
  })().catch((error: unknown) => {
    holder.__wishlistQueue = undefined;
    throw error;
  });
  return holder.__wishlistQueue;
}

export async function enqueueParse(itemId: string): Promise<void> {
  try {
    const boss = await queue();
    const job: ParseItemJob = { itemId };
    await boss.send(QUEUES.parseItem, job, PARSE_JOB_OPTIONS);
  } catch (error) {
    // Подарок уже сохранён; без воркера он останется pending, и страница предложит заполнить его вручную
    console.error("enqueue parse failed", { itemId, error: String(error) });
  }
}
