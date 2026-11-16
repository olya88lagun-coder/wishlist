import { isAffiliateStore } from "@wishlist/db";
import { EXTRA_STORES, type ExtraStore } from "@/app/go/store-routing";
import { SEARCH_STORES } from "@/app/go/store-search";

const TEMPLATE_ENV: Record<ExtraStore, string> = {
  chitaigorod: "AFFILIATE_CHITAIGOROD_TEMPLATE",
  lamoda: "AFFILIATE_LAMODA_TEMPLATE",
  aliexpress: "AFFILIATE_ALIEXPRESS_TEMPLATE",
};

// Дополнительный магазин предлагаем, только если для него задан партнёрский шаблон: пока шаблонов нет, сайт не меняется
export function enabledExtraStores(): ExtraStore[] {
  return EXTRA_STORES.filter((store) => Boolean(process.env[TEMPLATE_ENV[store]]?.trim()));
}

// Магазины, ссылки на которые рекламные (задан партнёрский шаблон): только рядом с ними нужна пометка «Реклама»
export function affiliateSearchStores(): string[] {
  return [...SEARCH_STORES, ...EXTRA_STORES].filter(isAffiliateStore);
}
