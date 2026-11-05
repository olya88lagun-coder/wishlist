import Link from "next/link";
import type { ReactNode } from "react";
import "./santa.css";

const exchangeDateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function SantaFrame({ children }: { children: ReactNode }) {
  return (
    <main className="santa-page">
      <div className="santa-masthead">
        <Link className="santa-brand" href="/" aria-label="MyWishList — на главную">MyWishList</Link>
        <span>Новогодняя игра</span>
      </div>
      {children}
    </main>
  );
}

export function SantaCover({ eyebrow, title, artwork, children }: {
  eyebrow: string;
  title: ReactNode;
  artwork: "gifts" | "envelope";
  children?: ReactNode;
}) {
  return (
    <header className="santa-cover">
      <div className="santa-cover__copy">
        <p className="santa-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </div>
      <div className="santa-cover__photo" aria-hidden="true" style={{ backgroundImage: `url(/santa/${artwork}.webp)` }} />
    </header>
  );
}

export function SantaFacts({ exchangeDate, budget, count }: {
  exchangeDate: string;
  budget: string;
  count?: number;
}) {
  return (
    <dl className="santa-facts">
      <div>
        <dt>Дата обмена</dt>
        <dd><time dateTime={exchangeDate}>{exchangeDateFormat.format(new Date(exchangeDate))}</time></dd>
      </div>
      {budget && <div><dt>Бюджет</dt><dd>{budget}</dd></div>}
      {count !== undefined && <div><dt>В игре</dt><dd>{count}</dd></div>}
    </dl>
  );
}
