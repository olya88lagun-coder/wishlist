# Task 3: Лендинг на `/`

**Files:**
- Modify: `apps/web/src/app/page.tsx` (заменить целиком)
- Create: `apps/web/src/components/SiteFooter.tsx`
- Modify: `apps/web/src/app/globals.css`, `apps/web/src/app/login/page.tsx` (подвал)

**Interfaces:**
- Consumes: `startLinks` (Task 2); `readViewer`, `getEnv`.
- Produces:
  ```tsx
  function SiteFooter(props: { botUsername: string }): JSX.Element; // Task 4 добавит ссылку на политику
  ```

Сейчас `/` сразу редиректит на `/login` — человек не из Telegram видит только кнопки входа. Лендинг объясняет продукт за один экран на телефоне и ведёт туда же. Залогиненные по-прежнему уходят на `/lists`. Страница остаётся `noindex` (SEO — отдельная задача в бэклоге).

- [x] **Step 1: Подвал**

`apps/web/src/components/SiteFooter.tsx`:
```tsx
export function SiteFooter({ botUsername }: { botUsername: string }) {
  return (
    <footer className="site-footer">
      <span>my-wish-list.online</span>
      <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer">
        Бот в Telegram
      </a>
    </footer>
  );
}
```

- [x] **Step 2: Лендинг**

`apps/web/src/app/page.tsx` — заменить целиком:
```tsx
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { startLinks } from "@/components/start-links";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Вставьте ссылку", text: "Из Wildberries, Ozon, Золотого Яблока, Яндекс Маркета или любого магазина — фото и цена подтянутся сами." },
  { title: "Отправьте друзьям", text: "Ссылка на список красиво разворачивается в Telegram, VK и MAX." },
  { title: "Получайте то, что хотели", text: "Друзья бронируют подарки без регистрации. Вы не узнаете, кто что дарит, а подарки не повторятся." },
] as const;

export default async function Home() {
  const { user } = await readViewer();
  if (user) redirect("/lists");
  const env = getEnv();
  const [primary, secondary] = startLinks(env.TELEGRAM_BOT_USERNAME, false);

  return (
    <main className="page landing">
      <p className="eyebrow">вишлист</p>
      <h1 className="display">
        Подарки, которые <i>правда хочется</i>
      </h1>
      <p className="landing__lead">
        Соберите список желаний за минуту и поделитесь им. Друзья выберут подарок — и никто не подарит второй такой же.
      </p>
      <div className="stack">
        <a className="button button--block" href={primary!.href} target="_blank" rel="noopener noreferrer">
          {primary!.label}
        </a>
        <a className="button button--ghost button--block" href={secondary!.href}>
          {secondary!.label}
        </a>
      </div>
      <ol className="landing__steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="landing__step">
            <span className="landing__number serif">{index + 1}</span>
            <div>
              <h2 className="landing__step-title">{step.title}</h2>
              <p className="muted" style={{ margin: 0 }}>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="muted">Бесплатно. Напомним гостям о празднике за 14, 7 и 2 дня.</p>
      <SiteFooter botUsername={env.TELEGRAM_BOT_USERNAME} />
    </main>
  );
}
```

`apps/web/src/app/globals.css` — в конец:
```css
.landing__lead { font-size: 18px; margin: 0 0 24px; }
.landing__steps { list-style: none; padding: 0; margin: 40px 0 24px; display: grid; gap: 22px; }
.landing__step { display: grid; grid-template-columns: 44px 1fr; gap: 12px; align-items: start; }
.landing__number { font-size: 34px; font-style: italic; line-height: 1; color: var(--pink); }
.landing__step-title { font-size: 17px; font-weight: 600; margin: 0 0 4px; }
.site-footer { display: flex; flex-wrap: wrap; gap: 8px 18px; justify-content: space-between; margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 13px; color: var(--ink-soft); }
.site-footer a { color: var(--ink-soft); }
```

`apps/web/src/app/login/page.tsx`: импорт `import { SiteFooter } from "@/components/SiteFooter";` и перед `</main>` добавить `<SiteFooter botUsername={env.TELEGRAM_BOT_USERNAME} />`.

- [x] **Step 3: Проверка**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS.

Локально (`pnpm dev:web`), окно без входа:
- `/` показывает лендинг: заголовок, две кнопки, три шага, подвал; на ширине 375 px всё в одну колонку, кнопки во всю ширину;
- после входа `/` перенаправляет на `/lists`;
- в тёмной теме системы текст читается (переменные темы уже есть в `globals.css`).

- [x] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web): landing page for visitors outside Telegram"
```
