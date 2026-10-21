import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES, SITE_NAME } from "@/content/og";
import { listWishlistsForOwner } from "@wishlist/db";
import { GiftFinder } from "./GiftFinder";
import { getDb } from "@/server/db";
import { GIFTS_HUB_FAQ } from "@/content/gifts-hub-faq";
import { faqPageJsonLd, giftsHubJsonLd } from "@/lib/structured-data";
import { isAffiliateEnabled } from "@/server/affiliate-notice";
import { enabledExtraStores } from "@/server/store-routing";
import { readViewer } from "@/server/viewer";

const HUB_TITLE = "AI-подбор подарков: идеи по человеку, поводу и бюджету";
const HUB_DESCRIPTION =
  "AI-помощник подбирает идеи подарков по человеку, поводу, интересам и бюджету. Понравившиеся варианты можно найти в магазинах и сохранить в вишлист.";

export const metadata: Metadata = {
  title: HUB_TITLE,
  description: HUB_DESCRIPTION,
  alternates: { canonical: "/gifts" },
  openGraph: {
    title: HUB_TITLE,
    description: HUB_DESCRIPTION,
    url: "/gifts",
    siteName: SITE_NAME,
    images: DEFAULT_OG_IMAGES,
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image.jpg"],
    title: HUB_TITLE,
    description: HUB_DESCRIPTION,
  },
};

const QUICK_LINKS = [
  ["Детям по возрасту", "for-children"], ["Книги", "books"], ["Спорт", "sport"],
  ["Маме", "for-mom"], ["Папе", "for-dad"], ["Девушке", "for-girlfriend"],
  ["Парню", "for-boyfriend"], ["Жене", "for-wife"], ["Мужу", "for-husband"],
  ["Другу", "for-friend"], ["Коллеге", "for-colleague"], ["Сестре", "for-sister"], ["Брату", "for-brother"],
  ["Бабушке", "for-grandma"], ["Дедушке", "for-grandpa"], ["Дочери", "for-daughter"], ["Сыну", "for-son"], ["Учителю", "for-teacher"], ["Руководителю", "for-boss"],
];

const FINDER_STEPS = [
  {
    title: "Персональные идеи",
    text: "Укажите получателя, повод, бюджет и интересы — подборка отталкивается от реального человека, а не от случайной витрины.",
  },
  {
    title: "Поиск в магазинах",
    text: "Каждая идея превращается в готовый поисковый запрос для Ozon, Wildberries и Яндекс Маркета.",
  },
  {
    title: "Сохранение без суеты",
    text: "Подарок можно сохранить в вишлист, чтобы вернуться к нему позже или поделиться с близкими.",
  },
] as const;

const PUBLIC_URL = process.env.APP_URL ?? "https://my-wish-list.online";

export const dynamic = "force-dynamic";

// Поле на главной передаёт интересы в адресе: подставляем их в форму, но запрос к AI отправляет только сам человек
const MAX_PREFILL_INTERESTS = 200;

export default async function GiftsPage({ searchParams }: { searchParams: Promise<{ interests?: string | string[] }> }) {
  const { interests } = await searchParams;
  const initialInterests = (typeof interests === "string" ? interests : "").trim().slice(0, MAX_PREFILL_INTERESTS);
  const { user } = await readViewer();
  const wishlists = user ? await listWishlistsForOwner(getDb(), user.id) : [];

  return (
    <main className="page page--wide gifts-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([...giftsHubJsonLd(PUBLIC_URL), faqPageJsonLd(GIFTS_HUB_FAQ)]) }} />
      <p className="eyebrow">my wish list · подарки</p>
      <h1 className="display">AI-подбор подарков: идеи, которые <i>попадут в точку</i></h1>
      <p className="gifts-page__lead">
        Расскажите о человеке, поводе и бюджете. Подберём идеи, которые можно сохранить в вишлист.
      </p>

      <GiftFinder initialInterests={initialInterests} wishlists={wishlists} isAuthenticated={Boolean(user)} showAdLabel={isAffiliateEnabled()} extraStores={enabledExtraStores()} />

      <section className="gifts-page__how" aria-labelledby="gift-how-title">
        <div className="gifts-page__how-copy">
          <p className="eyebrow">умный ориентир</p>
          <h2 id="gift-how-title">Как работает AI-подбор подарков</h2>
          <p>
            Вместо универсальных списков помощник собирает направления под конкретного человека:
            его привычки, интересы, повод и комфортный бюджет.
          </p>
        </div>
        <div className="gifts-page__how-grid">
          {FINDER_STEPS.map((step, index) => (
            <article className="gifts-page__how-card" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gifts-page__seo">
        <p className="eyebrow">Идеи подарков</p>
        <h2>Ищете подарок конкретному человеку?</h2>
        <p>
          Выберите подборку по получателю, поводу или бюджету.
          Найдите подходящее направление и уточните идеи в помощнике выше.
        </p>
        <div className="quick-link__row">
          {QUICK_LINKS.map(([label, slug]) => <a key={slug} className="button button--ghost button--small" href={`/gifts/${slug}`}>{label}</a>)}
        </div>
        <h3>По поводу</h3>
        <div className="quick-link__row">
          <a className="button button--ghost button--small" href="/gifts/birthday">День рождения</a>
          <a className="button button--ghost button--small" href="/gifts/new-year">Новый год</a>
          <a className="button button--ghost button--small" href="/gifts/wedding">Свадьба</a>
          <a className="button button--ghost button--small" href="/gifts/anniversary">Годовщина</a>
          <a className="button button--ghost button--small" href="/gifts/housewarming">Новоселье</a>
          <a className="button button--ghost button--small" href="/gifts/valentines-day">14 февраля</a>
          <a className="button button--ghost button--small" href="/gifts/march-8">8 Марта</a>
          <a className="button button--ghost button--small" href="/gifts/february-23">23 февраля</a>
          <a className="button button--ghost button--small" href="/gifts/secret-santa">Тайный Санта</a>
        </div>
        <h3>По бюджету</h3>
        <div className="quick-link__row">
          <a className="button button--ghost button--small" href="/gifts/under-1000">До 1 000 ₽</a>
          <a className="button button--ghost button--small" href="/gifts/under-3000">До 3 000 ₽</a>
          <a className="button button--ghost button--small" href="/gifts/under-5000">До 5 000 ₽</a>
          <a className="button button--ghost button--small" href="/gifts/under-10000">До 10 000 ₽</a>
          <a className="button button--ghost button--small" href="/gifts/under-15000">До 15 000 ₽</a>
          <a className="button button--ghost button--small" href="/gifts/under-20000">До 20 000 ₽</a>
        </div>
      </section>

      <section className="gifts-page__seo">
        <h2>Частые вопросы</h2>
        {GIFTS_HUB_FAQ.map((item) => (
          <div key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
