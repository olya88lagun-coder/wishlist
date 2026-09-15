# Task 8: Web — очередь, подарок «только по ссылке», actions

**Files:**
- Create: `apps/web/src/server/queue.ts`, `apps/web/src/app/lists/[id]/QuickLinkForm.tsx`
- Modify: `apps/web/src/server/forms.ts`, `apps/web/src/server/forms.test.ts`, `apps/web/src/app/lists/[id]/actions.ts`, `apps/web/src/app/lists/[id]/ItemFields.tsx`, `apps/web/next.config.ts`, `apps/web/package.json`

**Interfaces:**
- Consumes: `QUEUES`, `ParseItemJob`, `PARSE_JOB_OPTIONS` (Task 6); `addItem` → `{ needsParsing }`, `updateItem` → `{ ok, needsParsing }` (Task 5); `errorState`, `successState`, `formValues`, `LIMIT_MESSAGES`, `FormState`, `initialFormState` (план 2, Task 8); `SubmitButton` (план 2, Task 7).
- Produces:
  ```ts
  // server/queue.ts
  function enqueueParse(itemId: string): Promise<void>;     // никогда не бросает: при сбое пишет в лог, подарок остаётся pending
  // server/forms.ts (изменение)
  // parseItemForm: название обязательно, только если нет ссылки; ошибка «Вставьте ссылку или напишите название»
  // QuickLinkForm.tsx ("use client")
  function QuickLinkForm(props: { wishlistId: string }): JSX.Element;
  ```

- [ ] **Step 1: Форма подарка — название необязательно при ссылке (тест)**

В `apps/web/src/server/forms.test.ts` в `describe("parseItemForm", ...)`:

1. Тест `reports invalid link, price and missing title` заменить на:
```ts
  test("reports invalid link and price; a broken link alone does not require a title", () => {
    expect(parseItemForm(form({ title: "", url: "javascript:alert(1)", price: "дорого", note: "" }))).toEqual({
      ok: false,
      errors: { url: "Ссылка должна начинаться с https://", price: "Цена — число в рублях, например 2 490" },
    });
  });

  test("needs either a link or a title", () => {
    expect(parseItemForm(form({ title: "", url: "", price: "", note: "" }))).toEqual({
      ok: false,
      errors: { title: "Вставьте ссылку или напишите название" },
    });
  });

  test("a link alone is enough — the rest comes from the store", () => {
    expect(parseItemForm(form({ url: "https://www.wildberries.ru/catalog/173937886/detail.aspx?utm_source=tg" }))).toEqual({
      ok: true,
      value: { title: "", sourceUrl: "https://www.wildberries.ru/catalog/173937886/detail.aspx", priceKopecks: null, note: null, isMustHave: false },
    });
  });
```

Run: `pnpm vitest run apps/web/src/server/forms.test.ts`
Expected: FAIL — в первом тесте лишняя ошибка `title`, во втором сообщение «Введите название подарка», в третьем `ok: false`.

- [ ] **Step 2: Форма подарка (реализация)**

В `apps/web/src/server/forms.ts` в `parseItemForm` блок
```ts
  const errors: FieldErrors = {};
  const title = titleSchema(ITEM_TITLE_MAX, "Введите название подарка", "Название").safeParse(text(form, "title"));
  if (!title.success) errors.title = title.error.issues[0]!.message;

  const rawUrl = text(form, "url");
```
заменить на
```ts
  const errors: FieldErrors = {};
  const rawUrl = text(form, "url");
  const rawTitle = text(form, "title");
  // По ссылке название подтянет воркер; без ссылки подарок должен как-то называться
  if (rawTitle === "" && rawUrl === "") errors.title = "Вставьте ссылку или напишите название";
  if (rawTitle.length > ITEM_TITLE_MAX) errors.title = `Название длиннее ${ITEM_TITLE_MAX} символов`;
```
и в возвращаемом значении `title: title.data!` заменить на `title: rawTitle`.

Если `titleSchema` больше нигде в файле не используется для подарков — оставить (им пользуется `wishlistSchema`).

Run: `pnpm vitest run apps/web/src/server/forms.test.ts`
Expected: PASS.

- [ ] **Step 3: Отправка задач в очередь**

`apps/web/package.json` — в `dependencies` добавить `"pg-boss": "12.31.1"`.

`apps/web/next.config.ts` — в объект конфигурации добавить:
```ts
  // pg-boss тянет драйвер pg с опциональными нативными модулями: не бандлим, standalone-трассировка скопирует пакет
  serverExternalPackages: ["pg-boss"],
```

`apps/web/src/server/queue.ts`:
```ts
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
```

Run: `pnpm install && pnpm --filter @wishlist/web typecheck`
Expected: PASS. Если типы `PgBoss` не принимают `supervise/schedule/migrate` — свериться с `node_modules/pg-boss/dist/*.d.ts` (опции конструктора 12.31.1) и использовать фактические имена.

- [ ] **Step 4: Actions ставят задачу**

В `apps/web/src/app/lists/[id]/actions.ts`:
1. Добавить импорт `import { enqueueParse } from "@/server/queue";`.
2. В `addItemAction` строки после проверки `result.ok`:
```ts
  revalidatePath(`/lists/${wishlistId}`);
  return successState("Подарок добавлен");
```
заменить на:
```ts
  if (result.needsParsing) await enqueueParse(result.itemId);
  revalidatePath(`/lists/${wishlistId}`);
  return successState(result.needsParsing ? "Подарок добавлен — подтягиваем данные из магазина" : "Подарок добавлен");
```
3. В `updateItemAction` после `if (!result.ok) return errorState(...)` добавить:
```ts
  if (result.needsParsing) await enqueueParse(itemId);
```

- [ ] **Step 5: Быстрая форма «Вставьте ссылку»**

`apps/web/src/app/lists/[id]/QuickLinkForm.tsx`:
```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { initialFormState } from "../form-state";
import { addItemAction } from "./actions";

export function QuickLinkForm({ wishlistId }: { wishlistId: string }) {
  const [state, action] = useActionState(addItemAction.bind(null, wishlistId), initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  // Спека 3.2: на десктопе ссылку можно просто вставить Ctrl+V в любом месте страницы списка
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const text = event.clipboardData?.getData("text")?.trim() ?? "";
      if (!/^https?:\/\/\S+$/i.test(text) || !formRef.current) return;
      event.preventDefault();
      const input = formRef.current.elements.namedItem("url") as HTMLInputElement;
      input.value = text;
      formRef.current.requestSubmit();
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const error = state.errors.url ?? state.errors.title ?? (state.status === "error" ? state.message : null);

  return (
    <form ref={formRef} action={action} className="panel stack quick-link" style={{ marginBottom: 16 }} noValidate>
      <label htmlFor="quick-url" className="serif" style={{ fontSize: 20 }}>Вставьте ссылку на подарок</label>
      <div className="quick-link__row">
        <input
          id="quick-url"
          name="url"
          type="url"
          inputMode="url"
          className="input"
          placeholder="https://www.wildberries.ru/catalog/…"
          defaultValue={state.status === "error" ? (state.values.url ?? "") : ""}
          autoComplete="off"
        />
        <SubmitButton pendingText="Добавляем…">Добавить</SubmitButton>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {state.status === "success" && state.message && <p className="muted" role="status">{state.message}</p>}
    </form>
  );
}
```

В `apps/web/src/app/lists/[id]/ItemFields.tsx` у поля названия убрать атрибут `required` (при ссылке название необязательно).

Подключение формы на страницу и стили — в Task 9.

- [ ] **Step 6: Проверка и commit**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS, сборка успешна.

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): enqueue parsing for link-only items"
```
