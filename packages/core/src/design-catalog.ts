export const EXTRA_THEME_IDS = ["wedding", "quiet-luxury", "space", "flower-garden", "valentines", "march-8"] as const;
export type ExtraTheme = typeof EXTRA_THEME_IDS[number];

export const EXTRA_DESIGNS = [
  { id: "wedding", label: "Свадьба", description: "Пионы, жемчуг и шалфейные ленты", color: "#b5bea2" },
  { id: "quiet-luxury", label: "Тихая роскошь", description: "Молочный шёлк и тонкое золото", color: "#d6c3a1" },
  { id: "space", label: "Космос", description: "Планеты, звёзды и маленькая ракета", color: "#718fa9" },
  { id: "flower-garden", label: "Цветочный сад", description: "Акварельные розы и нежная зелень", color: "#d9b4c1" },
  { id: "valentines", label: "14 февраля", description: "Сердца, бордовый атлас и золото", color: "#954152" },
  { id: "march-8", label: "8 Марта", description: "Тюльпаны, мимоза и весенние ленты", color: "#e1cc82" },
] as const;

export function isExtraTheme(value: string): value is ExtraTheme {
  return EXTRA_THEME_IDS.some((id) => id === value);
}

/* ------------------------------------------------------------------ */
/* Единый каталог тем для экрана «Оформление списка».                  */
/* Порядок вывода и сезонные бейджи управляются отсюда, без правок UI. */
/* ------------------------------------------------------------------ */

export type BaseThemeId = "journal" | "celebration" | "children" | "children-pink" | "new-year";
export type CatalogThemeId = BaseThemeId | ExtraTheme;

export interface ThemeCatalogEntry {
  id: CatalogThemeId;
  label: string;
  /** Цена в рублях; 0 — бесплатная тема. */
  price: number;
  /** Темы с одной группой покупаются одним платежом (голубая + розовая = покупка «children»). */
  priceGroup: "free" | "children" | "celebration" | "new_year" | ExtraTheme;
}

/** Базовый порядок вне сезонов. */
export const THEME_CATALOG: readonly ThemeCatalogEntry[] = [
  { id: "journal", label: "Журнал", price: 0, priceGroup: "free" },
  { id: "children", label: "Голубой", price: 149, priceGroup: "children" },
  { id: "children-pink", label: "Розовый", price: 149, priceGroup: "children" },
  { id: "celebration", label: "Праздник", price: 149, priceGroup: "celebration" },
  { id: "new-year", label: "Новый год", price: 149, priceGroup: "new_year" },
  { id: "wedding", label: "Свадьба", price: 149, priceGroup: "wedding" },
  { id: "quiet-luxury", label: "Тихая роскошь", price: 149, priceGroup: "quiet-luxury" },
  { id: "space", label: "Космос", price: 149, priceGroup: "space" },
  { id: "flower-garden", label: "Цветочный сад", price: 149, priceGroup: "flower-garden" },
  { id: "valentines", label: "14 февраля", price: 149, priceGroup: "valentines" },
  { id: "march-8", label: "8 Марта", price: 149, priceGroup: "march-8" },
];

/**
 * Сезонные окна: тема поднимается на первое место и получает бейдж.
 * Даты в формате "MM-DD"; окно может переходить через новый год (НГ: 11-15 → 01-10).
 */
export const SEASONAL_WINDOWS: readonly { id: CatalogThemeId; from: string; to: string; badge: string }[] = [
  { id: "new-year", from: "11-15", to: "01-10", badge: "Хит сезона" },
  { id: "valentines", from: "01-25", to: "02-15", badge: "Скоро 14 февраля" },
  { id: "march-8", from: "02-20", to: "03-10", badge: "Скоро 8 Марта" },
];

function inWindow(mmdd: string, from: string, to: string): boolean {
  return from <= to ? mmdd >= from && mmdd <= to : mmdd >= from || mmdd <= to;
}

/** Активное сезонное окно на дату (первое по списку, если пересекаются). */
export function seasonalBoost(date: Date = new Date()): { id: CatalogThemeId; badge: string } | null {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const hit = SEASONAL_WINDOWS.find((w) => inWindow(mmdd, w.from, w.to));
  return hit ? { id: hit.id, badge: hit.badge } : null;
}

/** Каталог в порядке показа: сезонная тема первой, остальные — по THEME_CATALOG. */
export function orderedThemes(date: Date = new Date()): { entry: ThemeCatalogEntry; badge: string | null }[] {
  const boost = seasonalBoost(date);
  const list = THEME_CATALOG.map((entry) => ({ entry, badge: boost && boost.id === entry.id ? boost.badge : null }));
  if (boost) list.sort((a, b) => (a.entry.id === boost.id ? -1 : b.entry.id === boost.id ? 1 : 0));
  return list;
}
