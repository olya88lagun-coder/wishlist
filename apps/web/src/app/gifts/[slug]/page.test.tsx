import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/server/viewer", () => ({
  readViewer: vi.fn().mockResolvedValue({ user: null }),
}));

vi.mock("@/server/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@wishlist/db", () => ({
  listWishlistsForOwner: vi.fn(),
}));

import GiftRecipientPage, { generateMetadata } from "./page";

test("starts gift selection within the 3000-ruble page budget", async () => {
  const html = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "under-3000" }) }));
  expect(html).toContain('<option value="3000" selected="">');
  expect(html).not.toContain('<option value="5000" selected="">');
});

test("offers the disclosed Ozon partner product only on the budget collection", async () => {
  const budgetHtml = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "under-3000" }) }));
  expect(budgetHtml).toContain('aria-labelledby="partner-gift-title"');
  expect(budgetHtml).toContain("Для детей от 3 лет");
  expect(budgetHtml).toContain("Накорми животное");
  expect(budgetHtml).toContain("6679151160");
  expect(budgetHtml).toContain("Y1jgkD6uB6jK1phqkTLTbNKYS11A");
  expect(budgetHtml).toContain("https://takprdm.ru/0W9SRG82rWCjIQy0/?redirectTo=https%3A%2F%2Fozon.ru%2Fproduct%2F924034106&amp;erid=Y1jgkD6uB6jK1phqkTLTbNKYS11A");
  expect(budgetHtml).toContain('rel="sponsored nofollow noopener noreferrer"');
  expect(budgetHtml).not.toContain("548 ₽");

  const momHtml = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "for-mom" }) }));
  expect(momHtml).not.toContain("takprdm.ru");
});

test("marks store search links as advertising only when a partner template is configured", async () => {
  const saved = process.env.AFFILIATE_OZON_TEMPLATE;
  try {
    delete process.env.AFFILIATE_OZON_TEMPLATE;
    const plain = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "for-mom" }) }));
    expect(plain).not.toContain("Ссылки на магазины партнёрские");
    expect(plain).toContain("<span>Найти:</span>");

    process.env.AFFILIATE_OZON_TEMPLATE = "https://ad.example/g/CODE/?ulp={url}";
    const marked = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "for-mom" }) }));
    expect(marked).toContain("Ссылки на магазины партнёрские");
    expect(marked).toContain('<span class="gift-idea__ad">Реклама · найти:</span>');
  } finally {
    if (saved === undefined) delete process.env.AFFILIATE_OZON_TEMPLATE;
    else process.env.AFFILIATE_OZON_TEMPLATE = saved;
  }
});

test("offers Читай-город next to a book idea only after its partner template is configured", async () => {
  const saved = process.env.AFFILIATE_CHITAIGOROD_TEMPLATE;
  try {
    delete process.env.AFFILIATE_CHITAIGOROD_TEMPLATE;
    const without = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "for-mom" }) }));
    expect(without).not.toContain("store=chitaigorod");

    process.env.AFFILIATE_CHITAIGOROD_TEMPLATE = "https://ad.example/g/CODE/?ulp={url}";
    const withTemplate = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "for-mom" }) }));
    expect(withTemplate).toContain("store=chitaigorod");
    expect(withTemplate).toContain(">Читай-город</a>");
    expect(withTemplate).toContain("store=ozon");
  } finally {
    if (saved === undefined) delete process.env.AFFILIATE_CHITAIGOROD_TEMPLATE;
    else process.env.AFFILIATE_CHITAIGOROD_TEMPLATE = saved;
  }
});

test("shows brand cards with advertiser details only after the brand template is configured", async () => {
  const saved = process.env.AFFILIATE_TEFAL_TEMPLATE;
  try {
    delete process.env.AFFILIATE_TEFAL_TEMPLATE;
    const without = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "for-mom" }) }));
    expect(without).not.toContain("Посуда Tefal");

    process.env.AFFILIATE_TEFAL_TEMPLATE = "https://partner.example/g/CODE/?erid=ERID123&ulp={url}";
    const withTemplate = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "for-mom" }) }));
    expect(withTemplate).toContain("Посуда Tefal");
    expect(withTemplate).toContain("/go/brand?offer=tefal-posuda&amp;from=gifts%2Ffor-mom");
    expect(withTemplate).toContain('rel="sponsored nofollow noopener noreferrer"');
    expect(withTemplate).toContain("Реклама. ООО «Гипер». ИНН 7813122311. erid ERID123");
    expect(withTemplate).not.toContain("KRUPS");
  } finally {
    if (saved === undefined) delete process.env.AFFILIATE_TEFAL_TEMPLATE;
    else process.env.AFFILIATE_TEFAL_TEMPLATE = saved;
  }
});

test("shows МТС Shop product cards on a partner page with the advertiser details", async () => {
  const saved = process.env.AFFILIATE_MTS_TEMPLATE;
  try {
    process.env.AFFILIATE_MTS_TEMPLATE = "https://partner.example/g/CODE/?erid=MTSERID&ulp={url}";
    const html = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "for-boyfriend" }) }));
    expect(html).toContain("Смартфон Apple iPhone 18 Pro, 256 ГБ");
    expect(html).toContain("/go/brand?offer=mts-iphone-18-pro&amp;from=gifts%2Ffor-boyfriend");
    expect(html).toContain("Реклама. АО «РТК». ИНН 7709356049. erid MTSERID");
    expect(html).toContain("Посмотреть на shop.mts.ru");
  } finally {
    if (saved === undefined) delete process.env.AFFILIATE_MTS_TEMPLATE;
    else process.env.AFFILIATE_MTS_TEMPLATE = saved;
  }
});

test("has a books page with its own metadata, ideas and links to the stores", async () => {
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: "books" }) });
  expect(metadata.title).toBe("Книги в подарок: 15 идей с ценами");
  expect(metadata.alternates?.canonical).toBe("/gifts/books");

  const html = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "books" }) }));
  expect(html).toContain("<h1");
  expect(html).toContain("Книги в подарок");
  expect(html).toContain("store=ozon");
  expect(html).toContain("Чего лучше не дарить");
});

test("shows Спортмастер cards with the advertiser details once its template is set", async () => {
  const saved = process.env.AFFILIATE_SPORTMASTER_TEMPLATE;
  try {
    process.env.AFFILIATE_SPORTMASTER_TEMPLATE = "https://partner.example/g/CODE/?erid=SPORTERID&ulp={url}";
    const html = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "for-husband" }) }));
    expect(html).toContain("Велотренажёр магнитный Torneo Vita B-370BL");
    expect(html).toContain("/go/brand?offer=sportmaster-velotrenazher&amp;from=gifts%2Ffor-husband");
    expect(html).toContain("ООО «Спортмастер»");
    expect(html).toContain("7728551528");
  } finally {
    if (saved === undefined) delete process.env.AFFILIATE_SPORTMASTER_TEMPLATE;
    else process.env.AFFILIATE_SPORTMASTER_TEMPLATE = saved;
  }
});

function collectImageSources(node: ReactNode, sources: string[] = []): string[] {
  if (!isValidElement<{ src?: unknown; children?: ReactNode }>(node)) return sources;

  if (typeof node.props.src === "string" && node.props.src.startsWith("/gifts/seo/")) {
    sources.push(node.props.src);
  }

  Children.forEach(node.props.children, (child) => collectImageSources(child, sources));
  return sources;
}

describe("gift recipient editorial images", () => {
  test.each([
    ["for-dad", ["/gifts/seo/dad-1.webp", "/gifts/seo/dad-2.webp", "/gifts/seo/dad-3.webp"]],
    ["for-girlfriend", ["/gifts/seo/girlfriend-1.webp", "/gifts/seo/girlfriend-2.webp", "/gifts/seo/girlfriend-3.webp"]],
    ["for-boyfriend", ["/gifts/seo/boyfriend-1.webp", "/gifts/seo/boyfriend-2.webp", "/gifts/seo/boyfriend-3.webp"]],
    ["new-year", ["/gifts/seo/new-year-1.webp", "/gifts/seo/new-year-2.webp", "/gifts/seo/new-year-3.webp"]],
    ["under-3000", ["/gifts/seo/under-3000-1.webp", "/gifts/seo/under-3000-2.webp", "/gifts/seo/under-3000-3.webp"]],
    ["under-5000", ["/gifts/seo/under-5000-1.webp", "/gifts/seo/under-5000-2.webp", "/gifts/seo/under-5000-3.webp"]],
    ["under-10000", ["/gifts/seo/under-10000-1.webp", "/gifts/seo/under-10000-2.webp", "/gifts/seo/under-10000-3.webp"]],
    ["wedding", ["/gifts/seo/wedding-1.webp", "/gifts/seo/wedding-2.webp", "/gifts/seo/wedding-3.webp"]],
    ["anniversary", ["/gifts/seo/anniversary-1.webp", "/gifts/seo/anniversary-2.webp", "/gifts/seo/anniversary-3.webp"]],
    ["birthday", ["/gifts/seo/birthday-1.webp", "/gifts/seo/birthday-2.webp", "/gifts/seo/birthday-3.webp"]],
    ["for-wife", ["/gifts/seo/wife-1.webp", "/gifts/seo/wife-2.webp", "/gifts/seo/wife-3.webp"]],
    ["for-husband", ["/gifts/seo/husband-1.webp", "/gifts/seo/husband-2.webp", "/gifts/seo/husband-3.webp"]],
  ])("uses the dedicated image series for %s", async (slug, expectedSources) => {
    const page = await GiftRecipientPage({ params: Promise.resolve({ slug }) });

    expect(collectImageSources(page)).toEqual(expectedSources);
  });
});

test("has a sport page with its own metadata, ideas and Спортмастер cards", async () => {
  const saved = process.env.AFFILIATE_SPORTMASTER_TEMPLATE;
  try {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "sport" }) });
    expect(metadata.title).toBe("Подарки для спорта и активного отдыха: 15 идей с ценами");
    expect(metadata.alternates?.canonical).toBe("/gifts/sport");

    delete process.env.AFFILIATE_SPORTMASTER_TEMPLATE;
    const plain = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "sport" }) }));
    expect(plain).toContain("Подарки для спорта и активного отдыха");
    expect(plain).toContain("Чего лучше не дарить");
    expect(plain).not.toContain("/go/brand?offer=sportmaster");

    process.env.AFFILIATE_SPORTMASTER_TEMPLATE = "https://partner.example/g/CODE/?erid=SPORTERID&ulp={url}";
    const withCards = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "sport" }) }));
    expect(withCards).toContain("/go/brand?offer=sportmaster-yoga");
    expect(withCards).toContain("ООО «Спортмастер»");
  } finally {
    if (saved === undefined) delete process.env.AFFILIATE_SPORTMASTER_TEMPLATE;
    else process.env.AFFILIATE_SPORTMASTER_TEMPLATE = saved;
  }
});

test("puts the general advertising note at the bottom while the idea links keep their own label", async () => {
  const saved = process.env.AFFILIATE_OZON_TEMPLATE;
  try {
    process.env.AFFILIATE_OZON_TEMPLATE = "https://ad.example/g/CODE/?ulp={url}";
    const html = renderToStaticMarkup(await GiftRecipientPage({ params: Promise.resolve({ slug: "for-mom" }) }));
    const note = html.indexOf("Ссылки на магазины партнёрские");
    expect(note).toBeGreaterThan(html.lastIndexOf("gift-idea__stores"));
    expect(note).toBeGreaterThan(html.indexOf("Чего лучше не дарить"));
    expect(html).toContain("Реклама · найти:");
  } finally {
    if (saved === undefined) delete process.env.AFFILIATE_OZON_TEMPLATE;
    else process.env.AFFILIATE_OZON_TEMPLATE = saved;
  }
});
