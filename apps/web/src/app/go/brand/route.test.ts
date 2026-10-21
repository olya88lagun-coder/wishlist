import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@wishlist/db", async () => {
  const actual = await vi.importActual<typeof import("@wishlist/db")>("@wishlist/db");
  return { ...actual, recordStoreSearchClick: vi.fn(async () => undefined) };
});
vi.mock("@/server/db", () => ({ getDb: vi.fn(() => ({})) }));

const { GET } = await import("./route");
const { recordStoreSearchClick } = await import("@wishlist/db");
const { BRAND_OFFERS } = await import("@/content/brand-offers");

const offer = BRAND_OFFERS.find((item) => item.brand === "tefal")!;
const request = (query: string) => new NextRequest(`https://my-wish-list.online/go/brand?${query}`);
const original = { ...process.env };

describe("GET /go/brand", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    process.env = { ...original };
  });

  test("redirects to the partner link built from the brand template and counts the click", async () => {
    process.env.AFFILIATE_TEFAL_TEMPLATE = "https://partner.example/g/CODE/?erid=ERID&ulp={url}";

    const response = await GET(request(`offer=${offer.id}&from=gifts%2Ffor-mom`));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`https://partner.example/g/CODE/?erid=ERID&ulp=${encodeURIComponent(offer.target)}`);
    expect(recordStoreSearchClick).toHaveBeenCalledWith(expect.anything(), { store: "tefal", source: "gifts/for-mom", query: offer.id });
  });

  test("builds the Де-Парфюм partner link and counts the click under its own store", async () => {
    process.env.AFFILIATE_DEPARFUM_TEMPLATE = "https://partner.example/g/CODE/?erid=ERID&ulp={url}";
    const perfume = BRAND_OFFERS.find((item) => item.id === "deparfum-zhenskaya")!;

    const response = await GET(request(`offer=${perfume.id}&from=gifts%2Ffor-mom`));

    expect(response.headers.get("location")).toBe(`https://partner.example/g/CODE/?erid=ERID&ulp=${encodeURIComponent(perfume.target)}`);
    expect(recordStoreSearchClick).toHaveBeenCalledWith(expect.anything(), { store: "deparfum", source: "gifts/for-mom", query: perfume.id });
  });

  test("builds the Ormatek partner link and counts the click under its own store", async () => {
    process.env.AFFILIATE_ORMATEK_TEMPLATE = "https://partner.example/g/CODE/?erid=ERID&ulp={url}";
    const pillows = BRAND_OFFERS.find((item) => item.id === "ormatek-podushki")!;

    const response = await GET(request(`offer=${pillows.id}&from=gifts%2Fhousewarming`));

    expect(response.headers.get("location")).toBe(`https://partner.example/g/CODE/?erid=ERID&ulp=${encodeURIComponent(pillows.target)}`);
    expect(recordStoreSearchClick).toHaveBeenCalledWith(expect.anything(), { store: "ormatek", source: "gifts/housewarming", query: pillows.id });
  });

  test("goes straight to the brand page when no template is set", async () => {
    delete process.env.AFFILIATE_TEFAL_TEMPLATE;
    const response = await GET(request(`offer=${offer.id}&from=gifts%2Ffor-mom`));
    expect(response.headers.get("location")).toBe(offer.target);
  });

  test("answers 404 for an unknown offer and does not count it", async () => {
    const response = await GET(request("offer=unknown&from=x"));
    expect(response.status).toBe(404);
    expect(recordStoreSearchClick).not.toHaveBeenCalled();
  });
});
