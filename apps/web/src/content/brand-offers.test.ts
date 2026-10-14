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
    const targets = BRAND_OFFERS.filter((offer) => offer.brand === "sportmaster").map((offer) => offer.target);
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

describe("brandOffersForPage", () => {
  test("returns only offers of enabled brands, at most three, for that page", () => {
    const none = brandOffersForPage("for-mom", []);
    expect(none).toEqual([]);

    const tefal = brandOffersForPage("for-mom", ["tefal"]);
    expect(tefal.length).toBeGreaterThan(0);
    expect(tefal.length).toBeLessThanOrEqual(3);
    expect(tefal.every((offer) => offer.brand === "tefal")).toBe(true);

    expect(brandOffersForPage("for-dad", ["tefal", "krups"]).length).toBeLessThanOrEqual(3);
    expect(brandOffersForPage("under-20000", ["tefal", "krups"])).toEqual([]);
  });
});

describe("eridFromTemplate", () => {
  test("reads the marking token from a partner template", () => {
    expect(eridFromTemplate("https://partner.example/g/CODE/?erid=ABC123&ulp={url}")).toBe("ABC123");
    expect(eridFromTemplate("https://partner.example/g/CODE/?ulp={url}")).toBeNull();
    expect(eridFromTemplate(undefined)).toBeNull();
  });
});
