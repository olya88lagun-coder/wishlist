import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES, SITE_NAME } from "@/content/og";
import { listWishlistsForOwner } from "@wishlist/db";
import { GiftFinder } from "./GiftFinder";
import { getDb } from "@/server/db";
import { readViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Идеи подарков — AI-помощник",
  description: "Ответьте на несколько вопросов и получите персональные идеи подарков по человеку, поводу, интересам и бюджету.",
  alternates: { canonical: "/gifts" },
  openGraph: {
    title: "Идеи подарков — AI-помощник",
    description: "Персональные идеи подарков по человеку, поводу, интересам и бюджету.",
    url: "/gifts",
    siteName: SITE_NAME,
    images: DEFAULT_OG_IMAGES,
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image.jpg"],
    title: "Идеи подарков — AI-помощник",
    description: "Персональные идеи подарков по человеку, поводу, интересам и бюджету.",
  },
};

const QUICK_LINKS = [
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

export const dynamic = "force-dynamic";

export default async function GiftsPage() {
  const { user } = await readViewer();
  const wishlists = user ? await listWishlistsForOwner(getDb(), user.id) : [];

  return (
    <main className="page page--wide gifts-page">
      <p className="eyebrow">my wish list · подарки</p>
      <h1 className="display">Найти подарок, который <i>попадёт в точку</i></h1>
      <p className="gifts-page__lead">
        Расскажите о человеке, поводе и бюджете. Подберём идеи, которые можно сохранить в вишлист.
      </p>

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

      <GiftFinder wishlists={wishlists} isAuthenticated={Boolean(user)} />
      <section className="gifts-page__seo">
        <p className="eyebrow">Идеи подарков</p>
        <h2>Ищете подарок конкретному человеку?</h2>
        <p>
          Ниже собраны быстрые входы в SEO-подборки по получателю, поводу и бюджету.
          Они помогают начать с конкретного запроса и затем уточнить идею в AI-форме выше.
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
    </main>
  );
}
