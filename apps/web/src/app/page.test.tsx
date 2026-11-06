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
    expect(html).not.toContain("final-title");
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
    expect(html).toContain('href="/wishlist/birthday"');
    expect(html).toContain('href="/wishlist/new-year"');
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

  test("links to the Secret Santa game from the home page during the season only", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-12-01T12:00:00Z"));
      expect(renderToStaticMarkup(await Home())).toMatch(/<a[^>]*href="\/santa"[^>]*>Тайный Санта/);
      vi.setSystemTime(new Date("2027-02-01T12:00:00Z"));
      expect(renderToStaticMarkup(await Home())).not.toContain('href="/santa"');
    } finally {
      vi.useRealTimers();
    }
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

    expect(metadata.title).toEqual({ absolute: expect.stringMatching(/^Вишлист онлайн — .*список желаний/) });
    expect(metadata.description).toMatch(/^Вишлист онлайн/);
    expect(html).toMatch(/<h1[^>]*>Список желаний онлайн:/);
  });

  test("shows a guest wishlist preview next to the two creation links", async () => {
    const html = renderToStaticMarkup(await Home());
    const hero = html.slice(html.indexOf('class="hero"'), html.indexOf("home-trust"));

    expect(hero).toContain("Собрать в Telegram");
    expect(hero).toContain("Собрать на сайте");
    expect(hero).toContain("День рождения Ани");
    expect(hero).toContain("12 дней");
    expect(hero).toContain("Я подарю");
    expect(hero).toContain("Забронировано");
    expect(hero).not.toContain("<form");
    expect(hero).toContain('href="#finder"');
    expect(hero.match(/<img[^>]*>/g)!.every((img) => img.includes('loading="eager"'))).toBe(true);
  });

  test("repeats both creation links for guests after the FAQ", async () => {
    const html = renderToStaticMarkup(await Home());
    const final = html.slice(html.indexOf('id="final-title"'), html.indexOf('id="about"'));

    expect(html.indexOf('id="final-title"')).toBeGreaterThan(html.indexOf('id="faq"'));
    expect(final).toContain("Собрать в Telegram");
    expect(final).toContain("Собрать на сайте");
  });

  test("sends interests to /gifts from the dedicated AI finder section", async () => {
    const html = renderToStaticMarkup(await Home());
    const start = html.indexOf('id="finder"');
    const finder = html.slice(start, html.indexOf("</section>", start));

    expect(start).toBeGreaterThan(html.indexOf("home-trust"));
    expect(start).toBeLessThan(html.indexOf("occasions-title"));

    expect(finder).toMatch(/<form[^>]*action="\/gifts"[^>]*method="get"/);
    expect(finder).toContain('name="interests"');
    expect(finder).toContain("Подобрать с AI");
  });

  test("prioritizes New Year and Secret Santa in season and keeps the other links in HTML", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      async function occasionsAt(date: string) {
        vi.setSystemTime(new Date(date));
        const html = renderToStaticMarkup(await Home());
        return html.split('<div class="home-collections__group">')[1]!.split("</div>")[0]!;
      }

      const seasonal = await occasionsAt("2026-10-31T21:00:00Z");
      const firstLinks = [...seasonal.matchAll(/href="([^"]+)"/g)].slice(0, 2).map((match) => match[1]);
      expect(firstLinks).toEqual(["/gifts/new-year", "/gifts/secret-santa"]);
      expect(seasonal).toMatch(/<details[^>]*><summary[^>]*>Показать все<\/summary>[\s\S]*href="\/gifts\/march-8"/);

      const offSeason = await occasionsAt("2027-01-15T21:00:00Z");
      expect(offSeason.match(/href="([^"]+)"/)?.[1]).toBe("/gifts/birthday");
      expect(offSeason).toContain('href="/gifts/secret-santa"');
    } finally {
      vi.useRealTimers();
    }
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
