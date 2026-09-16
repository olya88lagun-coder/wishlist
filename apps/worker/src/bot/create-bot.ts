import type { NotifyJob, ParseItemJob } from "@wishlist/core";
import { adminStats, type Database } from "@wishlist/db";
import { Bot } from "grammy";
import type { TelegramConfig } from "../env";
import type { Logger } from "../log";
import { addLinksFromMessage } from "./add-links";
import { handleCallback } from "./callbacks";
import { FEEDBACK_PROMPT, FEEDBACK_START_PAYLOAD, FEEDBACK_THANKS, feedbackHeader, isFeedbackReply } from "./feedback";
import { answerInline } from "./inline";
import { ensureBotUser, startReply } from "./start";
import { STATS_WINDOW_DAYS, statsText } from "./stats";

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

const FEEDBACK_REPLY_MARKUP = { force_reply: true, input_field_placeholder: "Ваш отзыв" } as const;

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
    if (ctx.match === FEEDBACK_START_PAYLOAD) {
      await ctx.reply(FEEDBACK_PROMPT, { reply_markup: FEEDBACK_REPLY_MARKUP });
      return;
    }
    const reply = await startReply({ db: deps.db, appUrl: deps.config.appUrl, sessionSecret: deps.config.sessionSecret }, ctx.from, ctx.match);
    await ctx.reply(reply.text, { parse_mode: "HTML", ...reply.extra });
  });

  // Администратору: узнать свой id для ADMIN_TELEGRAM_ID
  bot.command("myid", async (ctx) => {
    if (ctx.from) await ctx.reply(`Ваш Telegram id: ${ctx.from.id}`);
  });

  bot.command("feedback", async (ctx) => {
    await ctx.reply(FEEDBACK_PROMPT, { reply_markup: FEEDBACK_REPLY_MARKUP });
  });

  // Ответ на вопрос об отзыве — раньше обработчика ссылок, чтобы отзыв со ссылкой не стал подарком
  bot.chatType("private").on("message", async (ctx, next) => {
    if (!isFeedbackReply(ctx.message, ctx.me.id)) return next();
    const adminId = deps.config.adminId;
    if (adminId === null) {
      deps.log("warn", "feedback received without admin configured");
    } else {
      await ctx.api.sendMessage(adminId, feedbackHeader(ctx.from));
      await ctx.forwardMessage(adminId);
    }
    await ctx.reply(FEEDBACK_THANKS);
  });

  // Только администратору; остальным бот не показывает, что команда существует
  bot.command("stats", async (ctx) => {
    if (!ctx.from || deps.config.adminId === null || ctx.from.id !== deps.config.adminId) return;
    const since = new Date(Date.now() - STATS_WINDOW_DAYS * 86_400_000);
    await ctx.reply(statsText(await adminStats(deps.db, since)));
  });

  const cardDeps = { appUrl: deps.config.appUrl, imagesPublicBaseUrl: deps.imagesPublicBaseUrl };

  // Только личные сообщения: в группах бот не добавляет подарки
  bot.chatType("private").on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    const userId = await ensureBotUser(deps.db, ctx.from);
    await addLinksFromMessage(
      {
        ...cardDeps,
        db: deps.db,
        chatId: ctx.chat.id,
        enqueueParse: deps.enqueueParse,
        reply: (text, extra) => ctx.reply(text, { parse_mode: "HTML", ...extra }),
      },
      userId,
      ctx.message.text,
      ctx.message.entities ?? [],
    );
  });

  bot.on("callback_query:data", async (ctx) => {
    const userId = await ensureBotUser(deps.db, ctx.from);
    const outcome = await handleCallback({ ...cardDeps, db: deps.db, enqueueNotify: deps.enqueueNotify }, userId, ctx.callbackQuery.data);
    if (outcome.kind === "toast") {
      await ctx.answerCallbackQuery({ text: outcome.text });
      return;
    }
    await ctx.answerCallbackQuery();
    if (outcome.kind === "markup") await ctx.editMessageReplyMarkup({ reply_markup: outcome.markup });
    else await ctx.editMessageText(outcome.text, { parse_mode: "HTML", ...outcome.extra });
  });

  bot.on("inline_query", async (ctx) => {
    const answer = await answerInline({ db: deps.db, appUrl: deps.config.appUrl, now: () => new Date() }, ctx.from.id, ctx.inlineQuery.query);
    await ctx.answerInlineQuery(answer.results, answer.options);
  });

  bot.catch((error) => deps.log("error", "bot update failed", { updateId: error.ctx.update.update_id, error: String(error.error) }));

  await bot.api.setMyCommands([
    { command: "start", description: "Открыть вишлист" },
    { command: "feedback", description: "Написать отзыв" },
  ]);
  await bot.api.setChatMenuButton({
    menu_button: { type: "web_app", text: "Вишлист", web_app: { url: new URL("/tg", deps.config.appUrl).toString() } },
  });
  return bot;
}
