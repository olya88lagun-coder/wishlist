import type { BrandId } from "@/content/brand-offers";

export const BRAND_TEMPLATE_ENV: Record<BrandId, string> = {
  tefal: "AFFILIATE_TEFAL_TEMPLATE",
  krups: "AFFILIATE_KRUPS_TEMPLATE",
  mts: "AFFILIATE_MTS_TEMPLATE",
  sportmaster: "AFFILIATE_SPORTMASTER_TEMPLATE",
};

// Карточки бренда показываем, только если задан его партнёрский шаблон
export function enabledBrands(): BrandId[] {
  return (Object.keys(BRAND_TEMPLATE_ENV) as BrandId[]).filter((brand) => Boolean(process.env[BRAND_TEMPLATE_ENV[brand]]?.trim()));
}
