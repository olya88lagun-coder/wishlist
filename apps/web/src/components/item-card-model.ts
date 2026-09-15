import { detectStore, formatKopecks } from "@wishlist/core";

export type CardItem = { title: string; sourceUrl: string | null; priceKopecks: number | null; note: string | null; isMustHave: boolean };
export type CardModel = {
  title: string;
  priceText: string | null;
  storeLabel: string | null;
  monogram: string;
  note: string | null;
  isMustHave: boolean;
  href: string | null;
};

export function toCardModel(item: CardItem): CardModel {
  return {
    title: item.title,
    priceText: item.priceKopecks === null ? null : formatKopecks(item.priceKopecks),
    storeLabel: item.sourceUrl ? detectStore(item.sourceUrl).label : null,
    monogram: (item.title.trim()[0] ?? "?").toLocaleUpperCase("ru-RU"),
    note: item.note,
    isMustHave: item.isMustHave,
    href: item.sourceUrl,
  };
}
