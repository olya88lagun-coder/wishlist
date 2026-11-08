import Link from "next/link";
import type { DesignAccess } from "@wishlist/db";
import { isDedMorozSeason } from "@/components/santa-season";

// Письмо от Деда Мороза живёт в оформлении списка; эта карточка ведёт прямо к его форме.
// Только для новогодних списков и только в сезон, как баннер на главной.
export function DedMorozPromo({ wishlistId, occasion, access }: { wishlistId: string; occasion: string; access: DesignAccess }) {
  if (occasion !== "new_year" || !isDedMorozSeason()) return null;
  return (
    <section className="owner-design-promo" aria-label="Письмо от Деда Мороза">
      <div className="owner-design-promo__copy">
        <p className="owner-section-kicker">К Новому году</p>
        <h2>Ответ от Деда Мороза</h2>
        <p>{access.letter
          ? "Письмо куплено. Впишите имя и достижения ребёнка и скачайте лист A4 для печати."
          : "Именное письмо с именем ребёнка, его достижениями и главным желанием. Текст можно посмотреть бесплатно."}</p>
      </div>
      <div className="owner-design-promo__action">
        <Link className="button" href={`/lists/${wishlistId}/design?letter=1#letter`}>{access.letter ? "Скачать письмо" : "Написать ответ"}</Link>
      </div>
    </section>
  );
}
