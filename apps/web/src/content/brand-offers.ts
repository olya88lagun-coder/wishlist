// Карточки магазинов одного бренда (Tefal, KRUPS) и товаров МТС Shop на страницах подборок. Ведут на разделы каталога бренда:
// конкретные товары приходят и уходят, а раздел остаётся. Цены не указываем, их показывает магазин.
// Партнёрская ссылка собирается из шаблона на сервере (AFFILIATE_TEFAL_TEMPLATE / AFFILIATE_KRUPS_TEMPLATE),
// поэтому в коде нет ни кода площадки, ни erid.
export type BrandId = "tefal" | "krups" | "mts";

export type BrandOffer = {
  id: string;
  brand: BrandId;
  title: string;
  text: string;
  target: string;
  pages: readonly string[];
};

// Реквизиты рекламодателя из карточек программ Admitad (14.10.2026)
export const BRAND_ADVERTISER: Record<BrandId, { name: string; inn: string; site: string; label: string }> = {
  tefal: { name: "ООО «Гипер»", inn: "7813122311", site: "tefal.ru", label: "Tefal" },
  krups: { name: "ООО «Гипер»", inn: "7813122311", site: "krups.ru", label: "KRUPS" },
  mts: { name: "АО «РТК»", inn: "7709356049", site: "shop.mts.ru", label: "МТС Shop" },
};

export const BRAND_OFFERS: readonly BrandOffer[] = [
  {
    id: "tefal-posuda",
    brand: "tefal",
    title: "Посуда Tefal",
    text: "Сковороды, кастрюли и наборы для ежедневной готовки. Перед покупкой проверьте диаметр и подходит ли посуда к плите получателя.",
    target: "https://tefal.ru/category/posuda",
    pages: ["for-mom", "for-wife", "housewarming", "wedding"],
  },
  {
    id: "tefal-chajniki",
    brand: "tefal",
    title: "Чайники и термопоты Tefal",
    text: "Практичный подарок для дома или офиса. Посмотрите объём, материал корпуса и мощность.",
    target: "https://tefal.ru/category/chajniki-i-termopoty",
    pages: ["housewarming", "for-colleague", "for-teacher", "for-grandma"],
  },
  {
    id: "tefal-utjugi",
    brand: "tefal",
    title: "Утюги и парогенераторы Tefal",
    text: "Для тех, кто часто гладит. Сравните мощность, объём резервуара и вес.",
    target: "https://tefal.ru/category/utjugi-i-parogeneratory",
    pages: ["for-mom", "for-grandma", "housewarming"],
  },
  {
    id: "tefal-kofemashiny",
    brand: "tefal",
    title: "Кофемашины Tefal",
    text: "Для тех, кто начинает утро с кофе. Уточните, пьёт ли человек капучино или эспрессо, и сколько места на кухне.",
    target: "https://tefal.ru/category/kofemashiny",
    pages: ["birthday", "for-husband", "new-year"],
  },
  {
    id: "krups-avtomaticheskie",
    brand: "krups",
    title: "Автоматические кофемашины KRUPS",
    text: "Зерновой кофе без лишних действий. Подойдёт тем, кто пьёт кофе каждый день; проверьте размер и объём ёмкости для воды.",
    target: "https://krups.ru/collection/avtomaticheskie-kofemashiny",
    pages: ["for-dad", "for-husband", "birthday", "wedding"],
  },
  {
    id: "krups-kapsulnye",
    brand: "krups",
    title: "Капсульные кофемашины KRUPS",
    text: "Компактный вариант для дома или офиса. Уточните, какие капсулы человек уже использует.",
    target: "https://krups.ru/collection/kapsulnye-kofemashiny",
    pages: ["housewarming", "for-colleague", "new-year"],
  },
  {
    id: "krups-kofemolki",
    brand: "krups",
    title: "Кофемолки KRUPS",
    text: "Для тех, кто покупает кофе в зёрнах. Посмотрите тип помола и объём чаши.",
    target: "https://krups.ru/collection/kofemolki",
    pages: ["for-dad", "for-friend", "secret-santa", "birthday"],
  },
  {
    id: "krups-aksessuary",
    brand: "krups",
    title: "Аксессуары для кофемашин KRUPS",
    text: "Небольшое дополнение к кофемашине, которая уже есть у человека. Сверьте модель кофемашины, чтобы аксессуар подошёл.",
    target: "https://krups.ru/collection/aksessuary-dlya-kofemashin",
    pages: ["for-colleague", "secret-santa"],
  },
  {
    id: "mts-iphone-18-pro",
    brand: "mts",
    title: "Смартфон Apple iPhone 18 Pro, 256 ГБ",
    text: "Модель с памятью 256 ГБ, цвет Burgundy, eSIM + SIM. Перед покупкой уточните у получателя цвет и нужный объём памяти.",
    target: "https://shop.mts.ru/product/smartfon-apple-iphone-18-pro-256-gb-esim-sim-burgundy",
    pages: ["for-boyfriend", "for-husband", "for-son", "anniversary"],
  },
  {
    id: "mts-iphone-17",
    brand: "mts",
    title: "Смартфон Apple iPhone 17, 256 ГБ",
    text: "Модель с памятью 256 ГБ, чёрный цвет, eSIM + SIM. Узнайте, какой телефон у человека сейчас и нужна ли ему новая модель.",
    target: "https://shop.mts.ru/product/smartfon-apple-iphone-17-256-gb-esim-sim-black",
    pages: ["for-girlfriend", "for-wife", "for-daughter", "for-son", "anniversary"],
  },
  {
    id: "mts-ipad-mini-2024",
    brand: "mts",
    title: "Планшет Apple iPad mini (2024), 128 ГБ",
    text: "Компактный планшет с экраном 8,3 дюйма, Wi-Fi и Cellular, фиолетовый, 128 ГБ. Подойдёт для чтения, учёбы и дороги.",
    target: "https://shop.mts.ru/product/planshet-apple-ipad-mini-2024-128-gb-wi-fi-cellular-fioletovyj-mxpr3",
    pages: ["for-girlfriend", "for-wife", "for-daughter", "for-son", "for-boyfriend"],
  },
];

const MAX_OFFERS_PER_PAGE = 3;

export function brandOfferById(id: string): BrandOffer | undefined {
  return BRAND_OFFERS.find((offer) => offer.id === id);
}

export function brandOffersForPage(slug: string, enabled: readonly BrandId[]): BrandOffer[] {
  return BRAND_OFFERS.filter((offer) => enabled.includes(offer.brand) && offer.pages.includes(slug)).slice(0, MAX_OFFERS_PER_PAGE);
}

// erid лежит в самом шаблоне партнёрской ссылки, его же показываем в пометке рекламы
export function eridFromTemplate(template: string | undefined): string | null {
  return template?.match(/[?&]erid=([A-Za-z0-9]+)/)?.[1] ?? null;
}
