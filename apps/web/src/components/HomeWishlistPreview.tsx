import { ItemCard } from "./ItemCard";
import type { CardItem } from "./item-card-model";
import { ReservedSticker } from "./ReservedSticker";

const items = [
  { title: "Настольная лампа", priceKopecks: 329000, imageUrl: "/landing/demo-lamp.webp" },
  { title: "Наушники", priceKopecks: 599000, imageUrl: "/landing/demo-headphones.webp" },
  { title: "Подарочная книга", priceKopecks: 189000, imageUrl: "/landing/demo-book.webp" },
  { title: "Набор акварели", priceKopecks: 249000, imageUrl: "/landing/demo-watercolors.webp" },
] as const;

export function HomeWishlistPreview() {
  return (
    <figure className="home-preview">
      <figcaption className="home-preview__header">
        <div>
          <p className="home-preview__eyebrow">Пример вишлиста для гостей</p>
          <h2>День рождения Ани</h2>
        </div>
        <span className="sticker sticker--countdown">12 дней</span>
      </figcaption>
      <div className="home-preview__cards">
        {items.map((example, index) => {
          const item: CardItem = { ...example, sourceUrl: null, note: null, isMustHave: false };
          const reserved = index === 1;
          return (
            <ItemCard
              key={example.title}
              item={item}
              dimmed={reserved}
              eager
              sticker={reserved ? <ReservedSticker label="Забронировано" /> : undefined}
            >
              {index === 0 && <span className="home-preview__action">Я подарю</span>}
            </ItemCard>
          );
        })}
      </div>
    </figure>
  );
}
