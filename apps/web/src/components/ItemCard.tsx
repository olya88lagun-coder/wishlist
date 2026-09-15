import type { ReactNode } from "react";
import { type CardItem, toCardModel } from "./item-card-model";
import { StoreTile } from "./StoreTile";

export function ItemCard({ item, sticker, dimmed, children }: { item: CardItem; sticker?: ReactNode; dimmed?: boolean; children?: ReactNode }) {
  const card = toCardModel(item);
  return (
    <article className={dimmed ? "card card--dimmed" : "card"}>
      {sticker && <div className="card__sticker">{sticker}</div>}
      <StoreTile monogram={card.monogram} storeLabel={card.storeLabel} isMustHave={card.isMustHave} />
      <h3 className="card__title">
        {card.title}
        {card.isMustHave && <span className="visually-hidden"> — очень хочу</span>}
      </h3>
      {card.priceText && <p className="card__price">{card.priceText}</p>}
      {card.note && <p className="card__meta">{card.note}</p>}
      {card.href && (
        <a className="card__meta" href={card.href} target="_blank" rel="noopener noreferrer nofollow">
          Открыть в магазине ↗
        </a>
      )}
      {children && <div className="card__actions">{children}</div>}
    </article>
  );
}
