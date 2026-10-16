import { afterEach, describe, expect, test } from "vitest";
import { getAffiliateUrl } from "./affiliate";
import { violatesPartnerRules } from "./partner-rules";

describe("violatesPartnerRules", () => {
  test("blocks Lamoda brands named in Latin, Cyrillic and with endings", () => {
    expect(violatesPartnerRules("lamoda", ["кроссовки Nike мужские"])).toBe(true);
    expect(violatesPartnerRules("lamoda", ["Adidas Originals"])).toBe(true);
    expect(violatesPartnerRules("lamoda", ["футболка адидас"])).toBe(true);
    expect(violatesPartnerRules("lamoda", ["сумка из бершки"])).toBe(true);
    expect(violatesPartnerRules("lamoda", ["красное платье Red Valentino"])).toBe(true);
  });

  test("blocks the word «скидка» in any form for Lamoda", () => {
    expect(violatesPartnerRules("lamoda", ["платье со скидкой"])).toBe(true);
    expect(violatesPartnerRules("lamoda", ["скидки на обувь"])).toBe(true);
  });

  test("blocks Gold Apple's forbidden brands but not its other products", () => {
    expect(violatesPartnerRules("goldapple", ["Dior Sauvage"])).toBe(true);
    expect(violatesPartnerRules("goldapple", ["духи Шанель"])).toBe(true);
    expect(violatesPartnerRules("goldapple", ["набор для ухода за лицом"])).toBe(false);
  });

  test("does not match inside longer words", () => {
    expect(violatesPartnerRules("goldapple", ["подборка подарков"])).toBe(false);
    expect(violatesPartnerRules("lamoda", ["gaps and gapless"])).toBe(false);
    expect(violatesPartnerRules("lamoda", ["Gap кардиган"])).toBe(true);
  });

  test("looks into product urls and ignores stores without known rules", () => {
    expect(violatesPartnerRules("lamoda", ["https://www.lamoda.ru/p/rtl1/clothes-nike-krossovki/"])).toBe(true);
    expect(violatesPartnerRules("ozon", ["кроссовки Nike"])).toBe(false);
    expect(violatesPartnerRules(null, ["Nike"])).toBe(false);
  });
});

describe("violatesPartnerRules for Letual", () => {
  test("blocks the brands Letual forbids to advertise, in Latin and Cyrillic", () => {
    for (const text of ["Givenchy Irresistible", "духи Живанши", "Guerlain Terracotta", "Estee Lauder", "эсте лаудер крем", "Tom Ford Black Orchid", "том форд", "Jo Malone", "джо малон свеча", "La Mer Creme", "Kenzo Flower", "Clinique Moisture", "MAC помада", "Bobbi Brown", "бобби браун"]) {
      expect(violatesPartnerRules("letual", [text]), text).toBe(true);
    }
  });

  test("keeps ordinary beauty queries and short Cyrillic words safe", () => {
    for (const text of ["лак мерцающий для ногтей", "макияж набор кистей", "маска для лица", "клиника красоты", "томат", "набор для ухода за кожей"]) {
      expect(violatesPartnerRules("letual", [text]), text).toBe(false);
    }
  });

  test("shares Gold Apple's bans on Chanel, Dior and Kilian", () => {
    expect(violatesPartnerRules("letual", ["Dior Sauvage", "духи шанель"])).toBe(true);
    expect(violatesPartnerRules("letual", ["Kilian Love"])).toBe(true);
  });
});

describe("getAffiliateUrl with partner rules", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  test("builds the partner url for an allowed query", () => {
    process.env.AFFILIATE_LAMODA_TEMPLATE = "https://ad.example/g/CODE/?ulp={url}";
    const url = getAffiliateUrl("https://www.lamoda.ru/p/rtl1/clothes-plate/", "lamoda");
    expect(url).toBe("https://ad.example/g/CODE/?ulp=https%3A%2F%2Fwww.lamoda.ru%2Fp%2Frtl1%2Fclothes-plate%2F");
  });

  test("builds an Admitad deeplink for МТС Shop from the template", () => {
    process.env.AFFILIATE_MTS_TEMPLATE = "https://partner.example/g/CODE/?erid=ERID&ulp={url}";
    const url = getAffiliateUrl("https://shop.mts.ru/product/smartfon-1/", "mts");
    expect(url).toBe("https://partner.example/g/CODE/?erid=ERID&ulp=https%3A%2F%2Fshop.mts.ru%2Fproduct%2Fsmartfon-1%2F");
  });

  test("builds deeplinks for AliExpress and Читай-город from their templates", () => {
    process.env.AFFILIATE_ALIEXPRESS_TEMPLATE = "https://partner.example/g/CODE/?ulp={url}";
    process.env.AFFILIATE_CHITAIGOROD_TEMPLATE = "https://partner.example/g/CODE2/?erid=ERID&ulp={url}";
    expect(getAffiliateUrl("https://www.aliexpress.com/item/1.html", "aliexpress")).toBe("https://partner.example/g/CODE/?ulp=https%3A%2F%2Fwww.aliexpress.com%2Fitem%2F1.html");
    expect(getAffiliateUrl("https://www.chitai-gorod.ru/product/x-1", "chitaigorod")).toBe("https://partner.example/g/CODE2/?erid=ERID&ulp=https%3A%2F%2Fwww.chitai-gorod.ru%2Fproduct%2Fx-1");
  });

  test("falls back to the plain store url when the text breaks program rules", () => {
    process.env.AFFILIATE_LAMODA_TEMPLATE = "https://ad.example/g/CODE/?ulp={url}";
    const plain = "https://www.lamoda.ru/catalogsearch/result/?q=nike";
    expect(getAffiliateUrl(plain, "lamoda", "кроссовки nike")).toBe(plain);
  });
});

describe("violatesPartnerRules for AliExpress", () => {
  test("blocks derogatory words about goods that AliExpress asks not to use", () => {
    for (const text of ["халява с алиэкспресс", "дешевка для дома", "дешевизна товаров", "Халявные подарки"]) {
      expect(violatesPartnerRules("aliexpress", [text]), text).toBe(true);
    }
  });

  test("allows price words that AliExpress explicitly permits", () => {
    for (const text of ["недорогой подарок", "дешёвый подарок на 23 февраля", "подарок позволяющий сэкономить", "экономный набор"]) {
      expect(violatesPartnerRules("aliexpress", [text]), text).toBe(false);
    }
  });

  test("blocks comparisons with well-known brands, which would advertise copies", () => {
    for (const text of ["кроссовки Nike", "сумка Gucci", "наушники AirPods", "чехол для iPhone", "кроссовки адидас", "духи Шанель", "набор LEGO"]) {
      expect(violatesPartnerRules("aliexpress", [text]), text).toBe(true);
    }
  });

  test("does not block ordinary gift searches or words that merely start alike", () => {
    for (const text of ["коврик для йоги", "настольная лампа", "подарок для зарядки телефона", "легонький плед", "светильник"]) {
      expect(violatesPartnerRules("aliexpress", [text]), text).toBe(false);
    }
  });

  test("falls back to the plain store address for a banned search while allowed searches keep the partner link", () => {
    const saved = process.env.AFFILIATE_ALIEXPRESS_TEMPLATE;
    process.env.AFFILIATE_ALIEXPRESS_TEMPLATE = "https://partner.example/g/CODE/?ulp={url}";
    try {
      const plain = "https://aliexpress.ru/wholesale?SearchText=%D0%BA%D1%80%D0%BE%D1%81%D1%81%D0%BE%D0%B2%D0%BA%D0%B8";
      expect(getAffiliateUrl(plain, "aliexpress", "кроссовки Nike")).toBe(plain);
      expect(getAffiliateUrl(plain, "aliexpress", "коврик для йоги")).toContain("partner.example");
    } finally {
      if (saved === undefined) delete process.env.AFFILIATE_ALIEXPRESS_TEMPLATE;
      else process.env.AFFILIATE_ALIEXPRESS_TEMPLATE = saved;
    }
  });
});
