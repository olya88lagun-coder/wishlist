import Link from "next/link";
import type { DesignAccess } from "@wishlist/db";

const THEME_NAMES: Partial<Record<DesignAccess["theme"], string>> = {
  children: "Голубое оформление",
  "children-pink": "Розовое оформление",
  "new-year": "Новогоднее оформление",
};

// Заметная карточка над инструментами списка: оформление раньше пряталось внизу страницы, под настройками.
export function DesignPromo({ wishlistId, access }: { wishlistId: string; access: DesignAccess }) {
  const owned = access.children || access.newYear;
  const themeName = THEME_NAMES[access.theme];
  const href = `/lists/${wishlistId}/design`;
  return (
    <section className="owner-design-promo" aria-label="Оформление списка">
      <div className="owner-design-promo__copy">
        <p className="owner-section-kicker">{owned ? "Оформление" : "Новое"}</p>
        <h2>{!owned ? "Оформите список" : themeName ?? "Оформление куплено, но не применено"}</h2>
        <p>
          {!owned
            ? "Голубой, розовый или новогодний фон для страницы, которую увидят гости. Приглашение можно сделать картинкой для мессенджеров."
            : themeName ? "Можно сменить цвет или создать приглашение." : "Выберите цвет и нажмите «Применить»."}
        </p>
      </div>
      <div className="owner-design-promo__action">
        <span className="owner-design-promo__swatches" aria-hidden="true">
          <i className="design-swatch design-swatch--blue" /><i className="design-swatch design-swatch--pink" /><i className="design-swatch design-swatch--new-year" />
        </span>
        <Link className={owned ? "button button--ghost" : "button"} href={href}>{owned ? "Цвет и приглашение" : "Выбрать оформление"}</Link>
      </div>
    </section>
  );
}
