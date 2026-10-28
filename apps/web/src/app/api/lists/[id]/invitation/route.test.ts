import { beforeEach, expect, test, vi } from "vitest";
import { getDesignAccess, getOwnedWishlist } from "@wishlist/db";
import { readViewer } from "@/server/viewer";
import { renderInvitation } from "@/server/invitation-image";
import { POST } from "./route";

vi.mock("@wishlist/db", () => ({ getDesignAccess: vi.fn(), getOwnedWishlist: vi.fn() }));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/server/viewer", () => ({ readViewer: vi.fn() }));
vi.mock("@/server/env", () => ({ getEnv: () => ({ APP_URL: "https://example.test" }) }));
vi.mock("@/server/invitation-image", () => ({ renderInvitation: vi.fn() }));
const context = { params: Promise.resolve({ id: "list-1" }) };
const data = { name: "Саша", date: "2026-12-12", time: "15:00", place: "Частный адрес" };
const request = (body: unknown = data, origin = "https://example.test") => new Request("https://example.test/api/lists/list-1/invitation", { method: "POST", headers: { origin }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readViewer).mockResolvedValue({ user: { id: "owner" } as never, viewer: { userId: "owner", guestToken: null } });
  vi.mocked(getOwnedWishlist).mockResolvedValue({ id: "list-1", slug: "trusted-slug" } as never);
  vi.mocked(getDesignAccess).mockResolvedValue({ children: true, invitation: true, theme: "children" });
  vi.mocked(renderInvitation).mockImplementation(async () => new Response("png", { headers: { "Content-Type": "image/png" } }));
});

test("rejects cross-origin, unauthenticated and foreign-list requests", async () => {
  expect((await POST(request(data, "https://evil.test"), context)).status).toBe(403);
  vi.mocked(readViewer).mockResolvedValue({ user: null, viewer: { userId: null, guestToken: null } });
  expect((await POST(request(), context)).status).toBe(401);
  vi.mocked(readViewer).mockResolvedValue({ user: { id: "stranger" } as never, viewer: { userId: "stranger", guestToken: null } });
  vi.mocked(getOwnedWishlist).mockResolvedValue(null);
  expect((await POST(request(), context)).status).toBe(404);
  expect(renderInvitation).not.toHaveBeenCalled();
});

test("149-ruble theme alone cannot export a paid invitation", async () => {
  vi.mocked(getDesignAccess).mockResolvedValue({ children: true, invitation: false, theme: "children" });
  expect((await POST(request(), context)).status).toBe(403);
  expect(renderInvitation).not.toHaveBeenCalled();
});

test("validates payload and never accepts a client-supplied QR destination", async () => {
  expect((await POST(request({ ...data, name: "a".repeat(41) }), context)).status).toBe(400);
  expect((await POST(request({ ...data, shareUrl: "https://evil.test" }), context)).status).toBe(400);
  expect(renderInvitation).not.toHaveBeenCalled();
});

test("exports only the owner's trusted list URL with private cache headers", async () => {
  const response = await POST(request(), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("content-disposition")).toContain("invitation.png");
  expect(renderInvitation).toHaveBeenCalledWith(expect.objectContaining(data), "https://example.test/trusted-slug");
});
