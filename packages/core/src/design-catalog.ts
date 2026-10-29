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
