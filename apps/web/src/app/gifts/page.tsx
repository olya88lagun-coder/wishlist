import type { Metadata } from "next";
import { listWishlistsForOwner } from "@wishlist/db";
import { GiftFinder } from "./GiftFinder";
import { getDb } from "@/server/db";
import { readViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Идеи подарков — AI-помощник",
  description: "Ответьте на несколько вопросов и получите персональные идеи подарков по человеку, поводу, интересам и бюджету.",
  alternates: { canonical: "/gifts" },
};

const QUICK_LINKS = [
  ["Маме", "for-mom"], ["Папе", "for-dad"], ["Девушке", "for-girlfriend"],
  ["Парню", "for-boyfriend"], ["Жене", "for-wife"], ["Мужу", "for-husband"],
  ["Другу", "for-friend"], ["Коллеге", "for-colleague"],
];

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
      <GiftFinder wishlists={wishlists} />
      <section className="gifts-page__seo">
        <p className="eyebrow">Идеи подарков</p>
        <h2>Ищете подарок конкретному человеку?</h2>
        <div className="quick-link__row">
          {QUICK_LINKS.map(([label, slug]) => <a key={slug} className="button button--ghost button--small" href={`/gifts/${slug}`}>{label}</a>)}
        </div>
        <h3>По поводу</h3>
        <div className="quick-link__row">
          <a className="button button--ghost button--small" href="/gifts/birthday">День рождения</a>
          <a className="button button--ghost button--small" href="/gifts/new-year">Новый год</a>
          <a className="button button--ghost button--small" href="/gifts/wedding">Свадьба</a>
          <a className="button button--ghost button--small" href="/gifts/anniversary">Годовщина</a>
        </div>
        <h3>По бюджету</h3>
        <div className="quick-link__row">
          <a className="button button--ghost button--small" href="/gifts/under-5000">До 5 000 ₽</a>
          <a className="button button--ghost button--small" href="/gifts/under-10000">До 10 000 ₽</a>
          <a className="button button--ghost button--small" href="/gifts/under-20000">До 20 000 ₽</a>
        </div>
      </section>
    </main>
  );
}
