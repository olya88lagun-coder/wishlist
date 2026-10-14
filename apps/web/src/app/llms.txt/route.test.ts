import { expect, test } from "vitest";
import { ARTICLES } from "@/content/articles";
import { GET } from "./route";

test("llms.txt is plain text and links to the hubs and every article", async () => {
  const response = GET();
  const body = await response.text();

  expect(response.headers.get("content-type")).toContain("text/plain");
  expect(body.startsWith("# MyWishList")).toBe(true);
  expect(body).toContain("https://my-wish-list.online/gifts");
  for (const article of ARTICLES) expect(body).toContain(`https://my-wish-list.online/articles/${article.slug}`);
  expect(body).not.toContain("/go/");
});
