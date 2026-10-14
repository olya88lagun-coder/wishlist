import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const SOURCE = "https://www.ozon.ru/product/123/";
const PARTNER = "https://ad.example/g/CODE/?ulp=https%3A%2F%2Fwww.ozon.ru%2Fproduct%2F123%2F";

vi.mock("@wishlist/db", () => ({
  getGoTarget: vi.fn(async () => ({ itemId: "item-1", ownerId: "owner-1", sourceUrl: SOURCE, store: "ozon" })),
  getAffiliateUrl: vi.fn(() => PARTNER),
  recordAffiliateClick: vi.fn(async () => undefined),
}));
vi.mock("@/server/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/server/viewer", () => ({ readViewer: vi.fn() }));

const { GET } = await import("./route");
const { readViewer } = await import("@/server/viewer");
const { recordAffiliateClick } = await import("@wishlist/db");

const request = () => new NextRequest("https://my-wish-list.online/go/item-1");
const params = { params: Promise.resolve({ itemId: "item-1" }) };

describe("GET /go/[itemId]", () => {
  beforeEach(() => vi.clearAllMocks());

  test("sends a guest through the partner link and counts the click", async () => {
    vi.mocked(readViewer).mockResolvedValue({ user: null, viewer: { userId: null, guestToken: null } });

    const response = await GET(request(), params);

    expect(response.headers.get("location")).toBe(PARTNER);
    expect(recordAffiliateClick).toHaveBeenCalledTimes(1);
  });

  test("sends the list owner to the plain store url and does not count the click", async () => {
    vi.mocked(readViewer).mockResolvedValue({ user: null, viewer: { userId: "owner-1", guestToken: null } });

    const response = await GET(request(), params);

    expect(response.headers.get("location")).toBe(SOURCE);
    expect(recordAffiliateClick).not.toHaveBeenCalled();
  });
});
