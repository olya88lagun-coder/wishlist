import { detectStore, formatKopecks } from "@wishlist/core";
import type { ItemParseStatus } from "@wishlist/db";

export type CardItem = {
  title: string;
  sourceUrl: string | null;
  priceKopecks: number | null;
  note: string | null;
  isMustHave: boolean;
  imageUrl?: string | null;
  parseStatus?: ItemParseStatus;
  // Публичная страница передаёт /go/<id>, чтобы переход засчитался; у владельца — прямая ссылка
  linkHref?: string | null;
};

export type CardModel = {
  title: string;
  priceText: string | null;
  storeLabel: string | null;
  monogram: string;
  note: string | null;
  isMustHave: boolean;
  href: string | null;
  imageUrl: string | null;
  pending: boolean;
};

function displayTitle(title: string, storeLabel: string | null, pending: boolean): string {
  if (title.trim() !== "") return title;
  if (pending) return "Загружаем данные…";
  return storeLabel ? `Подарок из ${storeLabel}` : "Подарок";
}

export function toCardModel(item: CardItem): CardModel {
  const storeLabel = item.sourceUrl ? detectStore(item.sourceUrl).label : null;
  const pending = item.parseStatus === "pending";
  const title = displayTitle(item.title, storeLabel, pending);
  // Пока названия нет, монограмма — первая буква магазина, а не служебного текста «Загружаем…»
  const monogramSource = item.title.trim() !== "" ? item.title : (storeLabel ?? title);
  return {
    title,
    priceText: item.priceKopecks === null ? null : formatKopecks(item.priceKopecks),
    storeLabel,
    monogram: (monogramSource.trim()[0] ?? "?").toLocaleUpperCase("ru-RU"),
    note: item.note,
    isMustHave: item.isMustHave,
    href: item.sourceUrl ? (item.linkHref ?? item.sourceUrl) : null,
    imageUrl: item.imageUrl ?? null,
    pending,
  };
}
