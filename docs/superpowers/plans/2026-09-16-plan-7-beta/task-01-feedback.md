# Task 1: Отзыв в один шаг — `/feedback` в боте и ссылка на сайте

**Files:**
- Create: `apps/worker/src/bot/feedback.ts`
- Test: `apps/worker/src/bot/feedback.test.ts`
- Modify: `apps/worker/src/bot/create-bot.ts`, `apps/web/src/components/SiteFooter.tsx`

**Interfaces:**
- Consumes: `TelegramConfig.adminId` (план 4); `SiteFooter` (план 6).
- Produces:
  ```ts
  const FEEDBACK_START_PAYLOAD = "feedback";
  const FEEDBACK_PROMPT: string;
  const FEEDBACK_THANKS: string;
  type ReplyLike = { reply_to_message?: { from?: { id: number }; text?: string } };
  function isFeedbackReply(message: ReplyLike, botId: number): boolean;
  function feedbackHeader(from: { id: number; username?: string }): string; // строка для администратора перед пересланным сообщением
  ```

Участник беты пишет `/feedback` (или нажимает «Написать отзыв» на сайте → `t.me/<бот>?start=feedback`), бот отвечает сообщением-вопросом с `force_reply`, ответ на него пересылается администратору. В базе отзывы не хранятся. Ответ на вопрос распознаётся раньше обработчика ссылок, поэтому отзыв со ссылкой не превращается в подарок.

- [x] **Step 1: Ветка**

```bash
git checkout master && git pull --ff-only && git checkout -b feat/beta
git add docs/superpowers/plans/2026-09-16-plan-7-beta
git commit -m "docs: plan 7 (closed beta)"
```

- [x] **Step 2: Тест (падает)**

`apps/worker/src/bot/feedback.test.ts`:
```ts
import { expect, test } from "vitest";
import { FEEDBACK_PROMPT, feedbackHeader, isFeedbackReply } from "./feedback";

const BOT_ID = 7000;

test("only replies to the bot's feedback question count as feedback", () => {
  expect(isFeedbackReply({ reply_to_message: { from: { id: BOT_ID }, text: FEEDBACK_PROMPT } }, BOT_ID)).toBe(true);
  expect(isFeedbackReply({ reply_to_message: { from: { id: BOT_ID }, text: "Карточка подарка" } }, BOT_ID)).toBe(false);
  expect(isFeedbackReply({ reply_to_message: { from: { id: 1 }, text: FEEDBACK_PROMPT } }, BOT_ID)).toBe(false);
  expect(isFeedbackReply({}, BOT_ID)).toBe(false);
});

test("the admin sees who wrote, to be able to answer", () => {
  expect(feedbackHeader({ id: 555, username: "olya" })).toBe("📝 Отзыв от @olya (id 555):");
  expect(feedbackHeader({ id: 555 })).toBe("📝 Отзыв от id 555:");
});
```

Run: `pnpm vitest run apps/worker/src/bot/feedback.test.ts`
Expected: FAIL — `Failed to resolve import "./feedback"`.

- [x] **Step 3: Реализация**

`apps/worker/src/bot/feedback.ts`:
```ts
export const FEEDBACK_START_PAYLOAD = "feedback";

export const FEEDBACK_PROMPT = "Что понравилось, что мешает или сломалось? Ответьте на это сообщение — прочитаю каждое.";
export const FEEDBACK_THANKS = "Спасибо! Передал. Если понадобится уточнить, напишу вам сюда.";

export type ReplyLike = { reply_to_message?: { from?: { id: number }; text?: string } };

export function isFeedbackReply(message: ReplyLike, botId: number): boolean {
  const original = message.reply_to_message;
  return original?.from?.id === botId && original.text === FEEDBACK_PROMPT;
}

export function feedbackHeader(from: { id: number; username?: string }): string {
  return from.username ? `📝 Отзыв от @${from.username} (id ${from.id}):` : `📝 Отзыв от id ${from.id}:`;
}
```

Run: `pnpm vitest run apps/worker/src/bot/feedback.test.ts`
Expected: PASS (2 теста).

- [x] **Step 4: Подключить к боту**

`apps/worker/src/bot/create-bot.ts` — импорт:
```ts
import { FEEDBACK_PROMPT, FEEDBACK_START_PAYLOAD, FEEDBACK_THANKS, feedbackHeader, isFeedbackReply } from "./feedback";
```

В обработчике `bot.command("start", ...)` в начало тела (после проверки `ctx.from`) добавить:
```ts
    if (ctx.match === FEEDBACK_START_PAYLOAD) {
      await ctx.reply(FEEDBACK_PROMPT, { reply_markup: { force_reply: true, input_field_placeholder: "Ваш отзыв" } });
      return;
    }
```

После команды `myid` добавить:
```ts
  bot.command("feedback", async (ctx) => {
    await ctx.reply(FEEDBACK_PROMPT, { reply_markup: { force_reply: true, input_field_placeholder: "Ваш отзыв" } });
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
```
Этот обработчик должен стоять **до** `bot.chatType("private").on("message:text", ...)` с добавлением ссылок.

В `setMyCommands` добавить команду:
```ts
  await bot.api.setMyCommands([
    { command: "start", description: "Открыть вишлист" },
    { command: "feedback", description: "Написать отзыв" },
  ]);
```

- [x] **Step 5: Ссылка на сайте**

`apps/web/src/components/SiteFooter.tsx` — после ссылки «Бот в Telegram» добавить:
```tsx
      <a href={`https://t.me/${botUsername}?start=feedback`} target="_blank" rel="noopener noreferrer">
        Написать отзыв
      </a>
```

- [x] **Step 6: Проверка и commit**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/worker build && pnpm --filter @wishlist/web build`
Expected: PASS.

```bash
git add apps
git commit -m "feat: one-step feedback from the bot and the site footer"
```
