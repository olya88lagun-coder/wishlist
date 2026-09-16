# Task 2: Картинка превью и мета-теги страницы

**Files:**
- Create: `apps/web/assets/fonts/PlayfairDisplay-SemiBoldItalic.ttf`, `apps/web/assets/fonts/Manrope-SemiBold.ttf`
- Create: `apps/web/src/app/[slug]/og-render.tsx`, `apps/web/src/app/[slug]/opengraph-image.tsx`
- Test: `apps/web/src/app/[slug]/og-render.test.tsx`
- Modify: `apps/web/src/app/layout.tsx` (metadataBase), `apps/web/src/app/[slug]/page.tsx` (`generateMetadata`)

**Interfaces:**
- Consumes: `ogModel`, `OgModel` (Task 1); `getPublicWishlist` из `@wishlist/db`; `getEnv().APP_URL`.
- Produces:
  ```ts
  // og-render.tsx
  const OG_SIZE: { width: 1200; height: 630 };
  type OgFont = { name: string; data: Buffer; weight: 600; style: "normal" | "italic" };
  function loadOgFonts(): Promise<OgFont[]>;
  function ogImageElement(model: OgModel): ReactElement;
  // opengraph-image.tsx
  export const size = OG_SIZE; export const contentType = "image/png"; export const alt: string;
  export const revalidate = 600;
  export default function Image({ params }: { params: Promise<{ slug: string }> }): Promise<ImageResponse>;
  ```

Картинка рисуется `next/og` (satori → resvg): поддерживаются только PNG и JPEG для вложенных картинок, поэтому фото подарков (WebP) в превью не попадают — только текст и стикер обратного отсчёта.

- [ ] **Step 1: Шрифты в репозитории**

Google Fonts отдаёт `.ttf` старым User-Agent:
```bash
mkdir -p apps/web/assets/fonts
PF=$(curl -sL -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,600" | grep -oE "https://[^)]+\.ttf" | head -1)
MR=$(curl -sL -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Manrope:wght@600" | grep -oE "https://[^)]+\.ttf" | head -1)
echo "$PF" && echo "$MR"
curl -sL "$PF" -o apps/web/assets/fonts/PlayfairDisplay-SemiBoldItalic.ttf
curl -sL "$MR" -o apps/web/assets/fonts/Manrope-SemiBold.ttf
ls -l apps/web/assets/fonts
```
Expected: два файла по 100–800 КБ. Проверить кириллицу:
```bash
node -e 'const b=require("fs").readFileSync("apps/web/assets/fonts/Manrope-SemiBold.ttf");console.log(b.length, b.includes(Buffer.from("Cyrillic","latin1")) || b.length > 80000)'
```
Expected: длина больше 80 000 — в файле есть кириллический набор (в Task 2 Step 4 это подтвердит отрисованный PNG).

Если Google отдал `.woff2` вместо `.ttf` (изменился ответ на старый UA) — взять статические файлы из репозитория Google Fonts:
`https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf` и `https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay-Italic%5Bwght%5D.ttf` (переменные шрифты; satori берёт из них начертание по умолчанию).

- [ ] **Step 2: Тест отрисовки (падает)**

`apps/web/src/app/[slug]/og-render.test.tsx`:
```tsx
import { ImageResponse } from "next/og";
import { expect, test } from "vitest";
import { loadOgFonts, OG_SIZE, ogImageElement } from "./og-render";

const MODEL = { eyebrow: "список Маши", title: "Маше 30", items: "3 подарка", countdown: "ДР через 7 дней" };

test("renders a PNG of the expected size that fits into messenger limits", async () => {
  const response = new ImageResponse(ogImageElement(MODEL), { ...OG_SIZE, fonts: await loadOgFonts() });
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(bytes.byteLength).toBeLessThan(300_000);
  expect(response.headers.get("content-type")).toBe("image/png");
}, 30_000);

test("works without a countdown", async () => {
  const response = new ImageResponse(ogImageElement({ ...MODEL, countdown: null }), { ...OG_SIZE, fonts: await loadOgFonts() });
  expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
}, 30_000);
```

Run: `pnpm vitest run "apps/web/src/app/\[slug\]/og-render.test.tsx"`
Expected: FAIL — `Failed to resolve import "./og-render"`.

- [ ] **Step 3: Отрисовка**

`apps/web/src/app/[slug]/og-render.tsx`:
```tsx
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactElement } from "react";
import type { OgModel } from "./og-model";

export const OG_SIZE = { width: 1200, height: 630 } as const;

// Палитра «Журнала» (globals.css): крем, графит, жёлтый стикер
const CREAM = "#F6F1E7";
const GRAPHITE = "#2C2C2A";
const YELLOW = "#FFE66D";
const MUTED = "#6F6B63";

export type OgFont = { name: string; data: Buffer; weight: 600; style: "normal" | "italic" };

export async function loadOgFonts(): Promise<OgFont[]> {
  const fonts = join(process.cwd(), "assets", "fonts");
  const [playfair, manrope] = await Promise.all([
    readFile(join(fonts, "PlayfairDisplay-SemiBoldItalic.ttf")),
    readFile(join(fonts, "Manrope-SemiBold.ttf")),
  ]);
  return [
    { name: "Playfair", data: playfair, weight: 600, style: "italic" },
    { name: "Manrope", data: manrope, weight: 600, style: "normal" },
  ];
}

// satori требует явный display: flex у каждого контейнера с несколькими детьми
export function ogImageElement(model: OgModel): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: CREAM,
        color: GRAPHITE,
        padding: "72px 80px",
        fontFamily: "Manrope",
      }}
    >
      <div style={{ display: "flex", fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: MUTED }}>{model.eyebrow}</div>
      <div style={{ display: "flex", fontFamily: "Playfair", fontStyle: "italic", fontSize: 92, lineHeight: 1.05 }}>{model.title}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 34 }}>{model.items}</div>
          {model.countdown !== null && (
            <div style={{ display: "flex", background: YELLOW, borderRadius: 999, padding: "14px 28px", fontSize: 30, transform: "rotate(-2deg)" }}>
              {model.countdown}
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: MUTED }}>my-wish-list.online</div>
      </div>
    </div>
  );
}
```

Run: `pnpm vitest run "apps/web/src/app/\[slug\]/og-render.test.tsx"`
Expected: PASS (2 теста). Если тест падает на `Cannot find module 'next/og'` в vitest — добавить в `apps/web/vitest.config.ts` `server: { deps: { inline: ["next"] } }`.

- [ ] **Step 4: Глазами**

```bash
node --experimental-strip-types -e '
const { ImageResponse } = await import("next/og");
const { ogImageElement, loadOgFonts, OG_SIZE } = await import("./apps/web/src/app/[slug]/og-render.tsx");
const r = new ImageResponse(ogImageElement({ eyebrow: "список Маши", title: "Маше 30 — большой праздник", items: "5 подарков", countdown: "ДР через 7 дней" }), { ...OG_SIZE, fonts: await loadOgFonts() });
require("node:fs").writeFileSync("og-preview.png", Buffer.from(await r.arrayBuffer()));
'
```
Открыть `og-preview.png` и проверить: кириллица видна (не квадраты), название в одну-две строки, стикер не наезжает на домен. Файл не коммитить:
```bash
rm og-preview.png
```

- [ ] **Step 5: Маршрут превью**

`apps/web/src/app/[slug]/opengraph-image.tsx`:
```tsx
import { getPublicWishlist } from "@wishlist/db";
import { ImageResponse } from "next/og";
import { getDb } from "@/server/db";
import { ogModel } from "./og-model";
import { loadOgFonts, OG_SIZE, ogImageElement } from "./og-render";

export const alt = "Вишлист";
export const size = OG_SIZE;
export const contentType = "image/png";
// Картинку тянут краулеры мессенджеров: десяти минут кэша достаточно, чтобы не рисовать её на каждый запрос
export const revalidate = 600;

const FALLBACK = { eyebrow: "вишлист", title: "Список подарков", items: "", countdown: null };

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Гостевой просмотр: зритель анонимный, брони и имена в картинку не попадают
  const view = await getPublicWishlist(getDb(), slug, { userId: null, guestToken: null });
  const model = view ? ogModel(view, new Date()) : FALLBACK;
  return new ImageResponse(ogImageElement(model), { ...size, fonts: await loadOgFonts() });
}
```

- [ ] **Step 6: Мета-теги**

`apps/web/src/app/layout.tsx` — заменить строку `export const metadata` на:
```ts
export const metadata: Metadata = {
  metadataBase: new URL(getEnv().APP_URL),
  title: "Вишлист",
  robots: { index: false, follow: false },
};
```
и добавить импорт `import { getEnv } from "@/server/env";`.

`apps/web/src/app/[slug]/page.tsx` — заменить `generateMetadata` целиком:
```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { viewer } = await readViewer();
  const view = await getPublicWishlist(getDb(), slug, viewer);
  if (!view) return { title: "Вишлист", robots: { index: false, follow: false } };
  const title = `${view.wishlist.title} — вишлист`;
  const description = `${view.ownerName} собирает подарки. Выбирайте и бронируйте — владелец не узнает, кто что дарит.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", locale: "ru_RU", siteName: "Вишлист", url: `/${view.wishlist.slug}` },
    twitter: { card: "summary_large_image", title, description },
  };
}
```
Ссылку на саму картинку Next добавит сам из файла `opengraph-image.tsx`.

- [ ] **Step 7: Проверка**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS; в выводе сборки есть маршрут `/[slug]/opengraph-image`.

Локальная проверка (три терминала: `pnpm dev:db`, `pnpm dev:web`, затем команда ниже) — нужен существующий список, slug взять из приложения:
```bash
curl -s -o /tmp/og.png -w "%{http_code} %{content_type} %{size_download}\n" "http://localhost:3000/<slug>/opengraph-image"
curl -s "http://localhost:3000/<slug>" | grep -oE '<meta property="og:[a-z:]+" content="[^"]{0,80}' | head -6
```
Expected: `200 image/png` и размер 20 000–300 000 байт; в разметке есть `og:title`, `og:description`, `og:image` (абсолютный адрес) и `og:image:width` 1200.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): journal-style link preview image for public wishlists"
```
