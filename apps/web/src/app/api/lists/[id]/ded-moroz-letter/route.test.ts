import { beforeEach, expect, test, vi } from "vitest";
import { getDesignAccess, getOwnedWishlist } from "@wishlist/db";
import { readViewer } from "@/server/viewer";
import { renderDedMorozLetter } from "@/server/ded-moroz-letter-image";
import { POST } from "./route";

vi.mock("@wishlist/db", () => ({ getDesignAccess: vi.fn(), getOwnedWishlist: vi.fn() }));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/server/viewer", () => ({ readViewer: vi.fn() }));
vi.mock("@/server/env", () => ({ getEnv: () => ({ APP_URL: "https://example.test" }) }));
vi.mock("@/server/ded-moroz-letter-image", () => ({ renderDedMorozLetter: vi.fn() }));
const context = { params: Promise.resolve({ id: "list-1" }) };
const data = { name: "Саша", gender: "boy", age: "6", achievements: ["научился читать"], gift: "конструктор" };
const request = (body: unknown = data, origin = "https://example.test") => new Request("https://example.test/api/lists/list-1/ded-moroz-letter", { method: "POST", headers: { origin }, body: JSON.stringify(body) });
const access = { children: false, invitation: false, theme: "new-year", newYear: true, letter: true, celebration: false } as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readViewer).mockResolvedValue({ user: { id: "owner" } as never, viewer: { userId: "owner", guestToken: null } });
  vi.mocked(getOwnedWishlist).mockResolvedValue({ id: "list-1", slug: "trusted-slug" } as never);
  vi.mocked(getDesignAccess).mockResolvedValue(access);
  vi.mocked(renderDedMorozLetter).mockImplementation(async () => new Response("png", { headers: { "Content-Type": "image/png" } }));
});

test("rejects cross-origin, unauthenticated and foreign-list requests", async () => {
  expect((await POST(request(data, "https://evil.test"), context)).status).toBe(403);
  vi.mocked(readViewer).mockResolvedValue({ user: null, viewer: { userId: null, guestToken: null } });
  expect((await POST(request(), context)).status).toBe(401);
  vi.mocked(readViewer).mockResolvedValue({ user: { id: "stranger" } as never, viewer: { userId: "stranger", guestToken: null } });
  vi.mocked(getOwnedWishlist).mockResolvedValue(null);
  expect((await POST(request(), context)).status).toBe(404);
  expect(renderDedMorozLetter).not.toHaveBeenCalled();
});

test("New Year theme alone cannot export the paid letter", async () => {
  vi.mocked(getDesignAccess).mockResolvedValue({ ...access, letter: false });
  expect((await POST(request(), context)).status).toBe(403);
  expect(renderDedMorozLetter).not.toHaveBeenCalled();
});

test("validates payload", async () => {
  expect((await POST(request({ ...data, age: "40" }), context)).status).toBe(400);
  expect((await POST(request({ ...data, extra: "x" }), context)).status).toBe(400);
  expect(renderDedMorozLetter).not.toHaveBeenCalled();
});

test("returns a private PNG", async () => {
  const response = await POST(request(), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("content-disposition")).toContain("pismo-ot-deda-moroza.png");
  expect(renderDedMorozLetter).toHaveBeenCalledWith(expect.objectContaining({ name: "Саша", gift: "конструктор" }));
});
