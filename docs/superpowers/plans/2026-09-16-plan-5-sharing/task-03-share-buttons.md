# Task 3: Кнопки «Поделиться» — Telegram, VK, MAX

**Files:**
- Create: `apps/web/src/app/[slug]/share-links.ts`
- Test: `apps/web/src/app/[slug]/share-links.test.ts`
- Modify: `apps/web/src/components/ShareBar.tsx`, `apps/web/src/app/[slug]/page.tsx` (передача заголовка)

**Interfaces:**
- Consumes: ничего из новых модулей.
- Produces:
  ```ts
  type ShareTarget = { id: "telegram" | "vk" | "max"; label: string; url: string };
  function shareLinks(url: string, title: string): ShareTarget[];
  ```

Адреса шеринга: Telegram `https://t.me/share/url?url=…&text=…`, VK `https://vk.com/share.php?url=…&title=…`, MAX `https://max.ru/:share?text=…` (адрес MAX официально не задокументирован — проверяется на телефоне в Task 4; если не сработает, кнопка убирается, и остаётся системное «Поделиться»).

- [x] **Step 1: Тест (падает)**

`apps/web/src/app/[slug]/share-links.test.ts`:
```ts
import { expect, test } from "vitest";
import { shareLinks } from "./share-links";

const URL_ = "https://my-wish-list.online/AbCdEfGhIj";
const TITLE = "Маше 30 — вишлист";

test("every target gets the list link and title, safely encoded", () => {
  const links = shareLinks(URL_, TITLE);
  expect(links.map((l) => l.id)).toEqual(["telegram", "vk", "max"]);
  for (const link of links) {
    const parsed = new URL(link.url);
    expect(parsed.protocol).toBe("https:");
    expect(link.url).toContain(encodeURIComponent(URL_));
    expect(link.url).not.toContain(" ");
  }
});

test("known addresses of the messengers", () => {
  const [telegram, vk, max] = shareLinks(URL_, TITLE);
  expect(telegram!.url).toBe(`https://t.me/share/url?url=${encodeURIComponent(URL_)}&text=${encodeURIComponent(TITLE)}`);
  expect(vk!.url).toBe(`https://vk.com/share.php?url=${encodeURIComponent(URL_)}&title=${encodeURIComponent(TITLE)}`);
  expect(max!.url).toBe(`https://max.ru/:share?text=${encodeURIComponent(`${TITLE} ${URL_}`)}`);
  expect([telegram!.label, vk!.label, max!.label]).toEqual(["Telegram", "VK", "MAX"]);
});
```

Run: `pnpm vitest run "apps/web/src/app/\[slug\]/share-links.test.ts"`
Expected: FAIL — `Failed to resolve import "./share-links"`.

- [x] **Step 2: Реализация**

`apps/web/src/app/[slug]/share-links.ts`:
```ts
export type ShareTarget = { id: "telegram" | "vk" | "max"; label: string; url: string };

// MAX принимает только текст, поэтому ссылка идёт внутри него
export function shareLinks(url: string, title: string): ShareTarget[] {
  const link = encodeURIComponent(url);
  return [
    { id: "telegram", label: "Telegram", url: `https://t.me/share/url?url=${link}&text=${encodeURIComponent(title)}` },
    { id: "vk", label: "VK", url: `https://vk.com/share.php?url=${link}&title=${encodeURIComponent(title)}` },
    { id: "max", label: "MAX", url: `https://max.ru/:share?text=${encodeURIComponent(`${title} ${url}`)}` },
  ];
}
```

Run: `pnpm vitest run "apps/web/src/app/\[slug\]/share-links.test.ts"`
Expected: PASS (2 теста).

- [x] **Step 3: Кнопки на странице**

`apps/web/src/components/ShareBar.tsx` — заменить целиком:
```tsx
"use client";

import { useEffect, useState } from "react";
import { shareLinks } from "@/app/[slug]/share-links";

const COPIED_RESET_MS = 2000;

export function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  // navigator есть только в браузере: проверяем после гидратации, иначе разметка сервера и клиента разойдётся
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => setCanNativeShare(typeof navigator.share === "function"), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      window.prompt("Скопируйте ссылку", url);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // пользователь закрыл системное окно — ничего не делаем
    }
  }

  return (
    <section className="panel stack" aria-label="Поделиться списком">
      <p className="muted" style={{ margin: 0, overflowWrap: "anywhere" }}>{url}</p>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button type="button" className="button button--small" onClick={copy}>{copied ? "Скопировано" : "Скопировать ссылку"}</button>
        {shareLinks(url, title).map((target) => (
          <a key={target.id} className="button button--ghost button--small" href={target.url} target="_blank" rel="noopener noreferrer">
            {target.label}
          </a>
        ))}
        {canNativeShare && <button type="button" className="button button--ghost button--small" onClick={nativeShare}>Ещё…</button>}
      </div>
    </section>
  );
}
```

`apps/web/src/app/[slug]/page.tsx` — заголовок для шеринга сделать таким же, как в превью: заменить
```tsx
        <ShareBar url={shareUrl} title={`${wishlist.title} — вишлист`} />
```
на
```tsx
        <ShareBar url={shareUrl} title={`${wishlist.title} — вишлист ${ownerName}`} />
```

- [x] **Step 4: Проверка и commit**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS.

Локально (`pnpm dev:web`) открыть публичную страницу списка: в блоке «Поделиться списком» пять элементов — «Скопировать ссылку», Telegram, VK, MAX и (на телефоне) «Ещё…». Кнопки не переносятся на новую строку по одной на десктопе.

```bash
git add apps/web
git commit -m "feat(web): share buttons for Telegram, VK and MAX"
```
