import type { NotifyJob, ParseItemJob } from "@wishlist/core";
import type { Database } from "@wishlist/db";
import { Bot } from "grammy";
import type { TelegramConfig } from "../env";
import type { Logger } from "../log";
import { startReply } from "./start";

export type BotDeps = {
  config: TelegramConfig;
  db: Database;
  log: Logger;
  imagesPublicBaseUrl: string | null;
  enqueueParse(job: ParseItemJob): Promise<void>;
  enqueueNotify(job: NotifyJob): Promise<void>;
};

// Telegram недоступен с машины разработчика (Казахстан): без таймаута bot.init() висит вечно
const API_TIMEOUT_SECONDS = 10;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalAppUrl(appUrl: string): boolean {
  return LOCAL_HOSTS.has(new URL(appUrl).hostname);
}

export async function createTelegramBot(deps: BotDeps): Promise<Bot | null> {
  // Локальная разработка: бот не нужен, а кнопки Mini App на localhost Telegram всё равно не примет
  if (isLocalAppUrl(deps.config.appUrl)) {
    deps.log("warn", "telegram bot skipped for local APP_URL");
    return null;
  }
  const bot = new Bot(deps.config.token, { client: { timeoutSeconds: API_TIMEOUT_SECONDS } });
  try {
    await bot.init();
  } catch (error) {
    // Локально токен фейковый: воркер должен работать и без бота
    deps.log("warn", "telegram bot token rejected", { error: String(error) });
    return null;
  }

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    const reply = await startReply({ db: deps.db, appUrl: deps.config.appUrl, sessionSecret: deps.config.sessionSecret }, ctx.from, ctx.match);
    await ctx.reply(reply.text, { parse_mode: "HTML", ...reply.extra });
  });

  // Администратору: узнать свой id для ADMIN_TELEGRAM_ID
  bot.command("myid", async (ctx) => {
    if (ctx.from) await ctx.reply(`Ваш Telegram id: ${ctx.from.id}`);
  });

  bot.catch((error) => deps.log("error", "bot update failed", { updateId: error.ctx.update.update_id, error: String(error.error) }));

  await bot.api.setMyCommands([{ command: "start", description: "Открыть вишлист" }]);
  await bot.api.setChatMenuButton({
    menu_button: { type: "web_app", text: "Вишлист", web_app: { url: new URL("/tg", deps.config.appUrl).toString() } },
  });
  return bot;
}
