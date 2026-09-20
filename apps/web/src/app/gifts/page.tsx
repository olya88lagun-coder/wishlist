import type { Metadata } from "next";
import { GiftFinder } from "./GiftFinder";

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

export default function GiftsPage() {
  return (
    <main className="page page--wide gifts-page">
      <p className="eyebrow">my wish list · подарки</p>
      <h1 className="display">Найти подарок, который <i>попадёт в точку</i></h1>
      <p className="gifts-page__lead">
        Расскажите о человеке, поводе и бюджете. Подберём идеи, которые можно сохранить в вишлист.
      </p>
      <GiftFinder />
      <section className="gifts-page__seo">
        <p className="eyebrow">Идеи подарков</p>
        <h2>Ищете подарок конкретному человеку?</h2>
        <div className="quick-link__row">
          {QUICK_LINKS.map(([label, slug]) => <a key={slug} className="button button--ghost button--small" href={`/gifts/${slug}`}>{label}</a>)}
        </div>
        <p className="muted">Скоро здесь появятся отдельные подборки по получателю, поводу и бюджету.</p>
      </section>
    </main>
  );
}
