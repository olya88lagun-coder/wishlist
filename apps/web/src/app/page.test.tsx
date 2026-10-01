import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { readViewer, getEnv } = vi.hoisted(() => ({
  readViewer: vi.fn(),
  getEnv: vi.fn(),
}));

vi.mock("@/server/viewer", () => ({ readViewer }));
vi.mock("@/server/env", () => ({ getEnv }));

import Home from "./page";

const guestViewer = { user: null, viewer: { userId: null, guestToken: null } };

function mockEnv() {
  getEnv.mockReturnValue({
    APP_URL: "https://my-wish-list.online",
    DATABASE_URL: "postgres://example",
    TELEGRAM_BOT_TOKEN: "123456:token",
    TELEGRAM_BOT_USERNAME: "mywishlist_bot",
    SESSION_SECRET: "12345678901234567890123456789012",
    VK_CLIENT_ID: "123456",
  });
}

describe("Home", () => {
  beforeEach(() => {
    mockEnv();
    readViewer.mockResolvedValue(guestViewer);
  });

  test("renders the public home page for signed-in users instead of redirecting to lists", async () => {
    readViewer.mockResolvedValue({ user: { id: "user-1", name: "Ольга" }, viewer: { userId: "user-1", guestToken: null } });

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("Подарки, которые");
    expect(html).toContain("Открыть мои списки");
    expect(html).toContain('href="/lists"');
    expect(html).toContain('href="/articles"');
  });

  test("renders premium trust signals, gift scenarios, and public structured data", async () => {
    const html = renderToStaticMarkup(await Home());

    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"SoftwareApplication"');
    expect(html).toContain("Подарки не повторяются");
    expect(html).toContain("День рождения");
    expect(html).toContain('href="/gifts/birthday"');
    expect(html).toContain('href="/articles/kak-sostavit-vishlist"');
  });
});
