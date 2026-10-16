import { describe, expect, test } from "vitest";
import { BRAND_ADVERTISER, BRAND_OFFERS, brandOfferById, brandOffersForPage, eridFromTemplate } from "./brand-offers";
import { GIFT_IDEAS } from "./gift-ideas";

describe("brand offers content", () => {
  test("ids are unique and every offer points to its own brand site over https", () => {
    expect(new Set(BRAND_OFFERS.map((offer) => offer.id)).size).toBe(BRAND_OFFERS.length);
    for (const offer of BRAND_OFFERS) {
      const url = new URL(offer.target);
      expect(url.protocol).toBe("https:");
      expect(url.hostname.replace(/^www\./, "")).toBe(BRAND_ADVERTISER[offer.brand].site);
      expect(offer.title.length).toBeGreaterThan(5);
      expect(offer.text.length).toBeGreaterThan(30);
    }
  });

  test("offers appear only on existing gift pages and never promise a price", () => {
    for (const offer of BRAND_OFFERS) {
      for (const slug of offer.pages) expect(GIFT_IDEAS[slug], `${offer.id} → ${slug}`).toBeDefined();
      expect(offer.text).not.toMatch(/₽|скидк|дешев/i);
    }
  });

  test("lookup by id", () => {
    expect(brandOfferById(BRAND_OFFERS[0]!.id)).toBe(BRAND_OFFERS[0]);
    expect(brandOfferById("nope")).toBeUndefined();
  });
});

describe("МТС Shop product cards", () => {
  test("link to the three chosen products on shop.mts.ru", () => {
    const targets = BRAND_OFFERS.filter((offer) => offer.brand === "mts").map((offer) => offer.target);
    expect(targets).toEqual([
      "https://shop.mts.ru/product/smartfon-apple-iphone-18-pro-256-gb-esim-sim-burgundy",
      "https://shop.mts.ru/product/smartfon-apple-iphone-17-256-gb-esim-sim-black",
      "https://shop.mts.ru/product/planshet-apple-ipad-mini-2024-128-gb-wi-fi-cellular-fioletovyj-mxpr3",
    ]);
  });

  test("appear on gift pages for a partner, husband or daughter but not on budget pages", () => {
    expect(brandOffersForPage("for-boyfriend", ["mts"]).length).toBeGreaterThan(0);
    expect(brandOffersForPage("for-daughter", ["mts"]).length).toBeGreaterThan(0);
    expect(brandOffersForPage("under-5000", ["mts"])).toEqual([]);
  });
});

describe("Спортмастер product cards", () => {
  test("link to the two chosen products on sportmaster.ru", () => {
    const targets = BRAND_OFFERS.filter((offer) => offer.brand === "sportmaster" && offer.target.includes("/product/")).map((offer) => offer.target);
    expect(targets).toEqual([
      "https://www.sportmaster.ru/product/32205860299/",
      "https://www.sportmaster.ru/product/34630220299/?skuId=79532010299",
    ]);
  });

  test("the exercise bike fits family pages and the snowboard fits winter and her pages", () => {
    expect(brandOffersForPage("for-husband", ["sportmaster"]).map((offer) => offer.id)).toContain("sportmaster-velotrenazher");
    expect(brandOffersForPage("new-year", ["sportmaster"]).map((offer) => offer.id)).toContain("sportmaster-snowboard");
    expect(brandOffersForPage("under-5000", ["sportmaster"])).toEqual([]);
  });
});

describe("Де-Парфюм section cards", () => {
  test("link to verified catalog sections of de-parfum.ru and name the advertiser", () => {
    const offers = BRAND_OFFERS.filter((offer) => offer.brand === "deparfum");
    expect(offers.map((offer) => new URL(offer.target).pathname)).toEqual([
      "/catalog/podarki/",
      "/catalog/podarochnye-nabory/",
      "/catalog/zhenskaya-parfyumeriya/",
      "/catalog/muzhskaya-parfyumeriya/",
      "/catalog/nabory-dlya-zhenshchin/",
      "/catalog/nabory-dlya-muzhchin/",
      "/catalog/nabory-probnikov/",
      "/catalog/aromaticheskie-svechi/",
    ]);
    expect(BRAND_ADVERTISER.deparfum).toEqual({ name: "ИП Банникова Инесса Владимировна", inn: "661219938108", site: "de-parfum.ru", label: "Де-Парфюм" });
  });

  test("women's pages and 8 March get perfume cards, men's pages get men's ones, budget pages get none", () => {
    expect(brandOffersForPage("for-mom", ["deparfum"]).map((offer) => offer.id)).toContain("deparfum-zhenskaya");
    expect(brandOffersForPage("march-8", ["deparfum"]).length).toBeGreaterThan(0);
    expect(brandOffersForPage("february-23", ["deparfum"]).map((offer) => offer.id)).toContain("deparfum-muzhskaya");
    expect(brandOffersForPage("for-husband", ["deparfum"]).map((offer) => offer.id)).not.toContain("deparfum-zhenskaya");
    expect(brandOffersForPage("under-5000", ["deparfum"])).toEqual([]);
  });
});

describe("sport page cards", () => {
  test("the sport page shows more Спортмастер cards than the usual three, other pages stay at three", () => {
    const sport = brandOffersForPage("sport", ["sportmaster"]);
    expect(sport.length).toBeGreaterThan(3);
    expect(sport.length).toBeLessThanOrEqual(12);
    expect(sport.every((offer) => offer.brand === "sportmaster")).toBe(true);
    expect(brandOffersForPage("for-mom", ["tefal", "krups", "mts", "sportmaster"]).length).toBeLessThanOrEqual(4);
  });

  test("category cards point to verified sections of sportmaster.ru", () => {
    const targets = BRAND_OFFERS.filter((offer) => offer.id.startsWith("sportmaster-") && offer.target.includes("/catalog/")).map((offer) => new URL(offer.target).pathname);
    expect(targets).toEqual([
      "/catalog/gifts/for-him/",
      "/catalog/gifts/for-her/",
      "/catalog/vidy_sporta_/yoga/",
      "/catalog/vidy_sporta_/kemping/",
      "/catalog/aksessuary/termosy/",
      "/catalog/vidy_sporta_/khokkey/konki/",
      "/catalog/vidy_sporta_/padel/",
      "/catalog/vidy_sporta_/plavanie/",
      "/catalog/vidy_sporta_/gornye_lyzhi/",
    ]);
  });
});

describe("brandOffersForPage", () => {
  test("returns only offers of enabled brands, at most four, for that page", () => {
    const none = brandOffersForPage("for-mom", []);
    expect(none).toEqual([]);

    const tefal = brandOffersForPage("for-mom", ["tefal"]);
    expect(tefal.length).toBeGreaterThan(0);
    expect(tefal.every((offer) => offer.brand === "tefal")).toBe(true);

    expect(brandOffersForPage("for-dad", ["tefal", "krups"]).length).toBeLessThanOrEqual(4);
    expect(brandOffersForPage("under-20000", ["tefal", "krups"])).toEqual([]);
  });

  test("shows at most four cards and at most two of one brand on ordinary gift pages", () => {
    const all = ["tefal", "krups", "mts", "sportmaster", "deparfum"] as const;
    for (const slug of Object.keys(GIFT_IDEAS).filter((page) => page !== "sport")) {
      const offers = brandOffersForPage(slug, all);
      expect(offers.length, slug).toBeLessThanOrEqual(4);
      for (const brand of all) {
        expect(offers.filter((offer) => offer.brand === brand).length, `${slug} ${brand}`).toBeLessThanOrEqual(2);
      }
    }
  });

  test("orders brands by earnings: Спортмастер, Де-Парфюм, then Tefal, МТС and KRUPS", () => {
    const all = ["tefal", "krups", "mts", "sportmaster", "deparfum"] as const;
    expect(brandOffersForPage("for-husband", all).map((offer) => offer.id)).toEqual([
      "sportmaster-velotrenazher",
      "sportmaster-gornye-lyzhi",
      "deparfum-muzhskaya",
      "deparfum-nabory-muzhchin",
    ]);
    expect(brandOffersForPage("for-husband", ["tefal", "krups", "mts"]).map((offer) => offer.brand)).toEqual(["tefal", "mts", "krups"]);
    expect(brandOffersForPage("for-dad", all).map((offer) => offer.brand)).toEqual(["sportmaster", "sportmaster", "krups", "krups"]);
  });

  test("puts Спортмастер cards first so seasonal sport offers are not pushed out by kitchen ones", () => {
    const ids = brandOffersForPage("new-year", ["tefal", "krups", "mts", "sportmaster"]).map((offer) => offer.id);
    expect(ids).toHaveLength(4);
    expect(ids.slice(0, 2).every((id) => id.startsWith("sportmaster-"))).toBe(true);
    expect(ids).toContain("sportmaster-snowboard");
    expect(ids).toContain("sportmaster-konki");
    expect(brandOffersForPage("for-son", ["tefal", "krups", "mts", "sportmaster"]).map((offer) => offer.id)).toEqual([
      "sportmaster-konki",
      "sportmaster-plavanie",
      "mts-iphone-18-pro",
      "mts-iphone-17",
    ]);
  });
});

describe("eridFromTemplate", () => {
  test("reads the marking token from a partner template", () => {
    expect(eridFromTemplate("https://partner.example/g/CODE/?erid=ABC123&ulp={url}")).toBe("ABC123");
    expect(eridFromTemplate("https://partner.example/g/CODE/?ulp={url}")).toBeNull();
    expect(eridFromTemplate(undefined)).toBeNull();
  });
});
