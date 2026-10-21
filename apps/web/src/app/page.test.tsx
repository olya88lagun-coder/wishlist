import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { readViewer, getEnv } = vi.hoisted(() => ({
  readViewer: vi.fn(),
  getEnv: vi.fn(),
}));

vi.mock("@/server/viewer", () => ({ readViewer }));
vi.mock("@/server/env", () => ({ getEnv }));

import Home, { generateMetadata } from "./page";
import sitemap from "./sitemap";

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

    expect(html).toContain("подарки, которые");
    expect(html).toContain("Открыть мои списки");
    expect(html).toContain('href="/lists"');
    expect(html).toContain('href="/articles"');
  });

  test("renders premium trust signals, gift scenarios, and public structured data", async () => {
    const html = renderToStaticMarkup(await Home());

    expect(html).toContain('type="application/ld+json"');
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
    expect(scripts).toHaveLength(1);
    const schema = JSON.parse(scripts[0]![1]!);
    expect(schema.map((item: { "@type": string }) => item["@type"])).toEqual([
      "WebSite", "Organization", "WebApplication", "FAQPage",
    ]);
    expect(schema[1].logo).toBe("https://my-wish-list.online/apple-icon.png");
    expect(html).toContain("Подарки не повторяются");
    expect(html).toContain("День рождения");
    expect(html).toContain('href="/gifts/birthday"');
    expect(html).toContain('href="/articles/kak-sostavit-vishlist"');
  });

  test("links every gift page of the sitemap from the home page", async () => {
    const html = renderToStaticMarkup(await Home());
    const giftPaths = sitemap()
      .map((entry) => new URL(entry.url).pathname)
      .filter((path) => path.startsWith("/gifts/"));

    expect(giftPaths.length).toBeGreaterThan(40);
    const missing = giftPaths.filter((path) => !html.includes(`href="${path}"`));
    expect(missing).toEqual([]);
  });

  test("shows a visible block of gift collections grouped by occasion, person, age, budget and interest", async () => {
    const html = renderToStaticMarkup(await Home());
    const block = html.slice(html.indexOf("Подборки подарков"));

    expect(html).toContain("Подборки подарков");
    for (const heading of ["По поводу", "Кому подарить", "Детям по возрасту", "По бюджету", "По интересам"]) {
      expect(block).toContain(heading);
    }
    expect(block).toContain('href="/gifts/for-child-3-years"');
    expect(block).toContain('href="/gifts/under-3000"');
    expect(block).toContain('href="/gifts/books"');
    expect(block).toContain(">Подарки маме<");
  });

  test("puts the main query into the title, the H1 and the description", async () => {
    const metadata = generateMetadata();
    const html = renderToStaticMarkup(await Home());

    expect(metadata.title).toEqual({ absolute: expect.stringContaining("Список желаний онлайн") });
    expect(metadata.description).toContain("Список желаний онлайн");
    expect(html).toMatch(/<h1[^>]*>Список желаний онлайн:/);
  });

  test("offers the AI gift finder on the first screen and sends the typed interests to /gifts", async () => {
    const html = renderToStaticMarkup(await Home());
    const hero = html.slice(html.indexOf('class="hero"'), html.indexOf("home-trust"));

    expect(hero).toMatch(/<form[^>]*action="\/gifts"[^>]*method="get"/);
    expect(hero).toContain('name="interests"');
    expect(hero).toContain("Подобрать с AI");
  });

  test("shows the FAQ and publishes the same questions as FAQPage data", async () => {
    const html = renderToStaticMarkup(await Home());
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
    const faq = JSON.parse(scripts[0]![1]!).find((item: { "@type": string }) => item["@type"] === "FAQPage");

    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(5);
    for (const entry of faq.mainEntity as { name: string; acceptedAnswer: { text: string } }[]) {
      expect(html).toContain(entry.name);
      expect(html).toContain(entry.acceptedAnswer.text);
    }
  });
});
