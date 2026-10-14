import { describe, expect, test } from "vitest";
import { BRAND_ADVERTISER, BRAND_OFFERS, brandOfferById, brandOffersForPage, eridFromTemplate } from "./brand-offers";
import { GIFT_IDEAS } from "./gift-ideas";

describe("brand offers content", () => {
  test("ids are unique and every offer points to its own brand site over https", () => {
    expect(new Set(BRAND_OFFERS.map((offer) => offer.id)).size).toBe(BRAND_OFFERS.length);
    for (const offer of BRAND_OFFERS) {
      const url = new URL(offer.target);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe(BRAND_ADVERTISER[offer.brand].site);
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
