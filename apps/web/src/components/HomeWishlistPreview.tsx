import { ItemCard } from "./ItemCard";
import type { CardItem } from "./item-card-model";
import { ReservedSticker } from "./ReservedSticker";
import { HomePreviewMotion } from "./HomePreviewMotion";

const items = [
  { title: "Настольная лампа", priceKopecks: 329000, imageUrl: "/landing/demo-lamp.webp" },
  { title: "Наушники", priceKopecks: 599000, imageUrl: "/landing/demo-headphones.webp" },
  { title: "Подарочная книга", priceKopecks: 189000, imageUrl: "/landing/demo-book.webp" },
  { title: "Набор акварели", priceKopecks: 249000, imageUrl: "/landing/demo-watercolors.webp" },
] as const;

export function HomeWishlistPreview() {
  return (
    <HomePreviewMotion>
      <figcaption className="home-preview__header">
        <div>
          <p className="home-preview__eyebrow">Пример вишлиста для гостей</p>
          <h2>День рождения Ани</h2>
        </div>
        <span className="sticker sticker--countdown home-preview__days">
          <span className="home-preview__days-current">12 дней</span>
          <span className="home-preview__days-next" aria-hidden="true">11 дней</span>
        </span>
      </figcaption>
      <p className="home-preview__secret">Аня не узнает, кто подарил 🤫</p>
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
              sticker={reserved ? <ReservedSticker label="Забронировано" /> : index === 0 ? (
                <span className="home-preview__stamp" aria-hidden="true"><ReservedSticker label="Забронировано" /></span>
              ) : undefined}
            >
              {index === 0 && (
                <span className="home-preview__action">
                  Я подарю
                  <svg className="home-preview__cursor" viewBox="0 0 26 32" width="26" height="32" aria-hidden="true">
                    <path d="M3 2l20 17-9 1 3 7-4 2-4-8-6 6z" fill="#702338" stroke="#fff7e5" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </ItemCard>
          );
        })}
      </div>
    </HomePreviewMotion>
  );
}
