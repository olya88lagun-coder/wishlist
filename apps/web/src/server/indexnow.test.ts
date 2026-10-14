import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { INDEXNOW_KEY, indexNowPayload, sitemapUrls } from "./indexnow";

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://my-wish-list.online</loc></url>
<url><loc>https://my-wish-list.online/gifts/for-mom</loc></url>
<url><loc>https://other.example/page</loc></url>
</urlset>`;

describe("IndexNow", () => {
  test("reads page addresses from a sitemap", () => {
    expect(sitemapUrls(SITEMAP)).toEqual(["https://my-wish-list.online", "https://my-wish-list.online/gifts/for-mom", "https://other.example/page"]);
  });

  test("payload keeps only addresses of our own host and points to the key file", () => {
    const payload = indexNowPayload("my-wish-list.online", INDEXNOW_KEY, sitemapUrls(SITEMAP));
    expect(payload.host).toBe("my-wish-list.online");
    expect(payload.key).toBe(INDEXNOW_KEY);
    expect(payload.keyLocation).toBe(`https://my-wish-list.online/${INDEXNOW_KEY}.txt`);
    expect(payload.urlList).toEqual(["https://my-wish-list.online", "https://my-wish-list.online/gifts/for-mom"]);
  });

  test("never sends more than the 10 000 addresses the protocol allows", () => {
    const many = Array.from({ length: 10_500 }, (_, index) => `https://my-wish-list.online/p/${index}`);
    expect(indexNowPayload("my-wish-list.online", INDEXNOW_KEY, many).urlList).toHaveLength(10_000);
  });

  test("the key is long enough and the public key file contains exactly the key", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/);
    const file = readFileSync(fileURLToPath(new URL(`../../public/${INDEXNOW_KEY}.txt`, import.meta.url)), "utf8");
    expect(file.trim()).toBe(INDEXNOW_KEY);
  });
});
