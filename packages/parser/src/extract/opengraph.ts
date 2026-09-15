import type { HtmlRoot } from "../html";
import { toKopecks } from "../price";
import type { ParsedProduct } from "../types";

function metaContent(root: HtmlRoot, key: string): string | null {
  const element = root.querySelector(`meta[property="${key}"]`) ?? root.querySelector(`meta[name="${key}"]`);
  const content = element?.getAttribute("content")?.trim();
  return content ? content : null;
}

export function extractOpenGraph(root: HtmlRoot): Partial<ParsedProduct> {
  const titleTag = root.querySelector("title")?.text.trim();
  return {
    title: metaContent(root, "og:title") ?? (titleTag ? titleTag : null),
    description: metaContent(root, "og:description") ?? metaContent(root, "description"),
    imageUrl: metaContent(root, "og:image:secure_url") ?? metaContent(root, "og:image"),
    priceKopecks: toKopecks(metaContent(root, "product:price:amount") ?? metaContent(root, "og:price:amount")),
    currency: metaContent(root, "product:price:currency") ?? metaContent(root, "og:price:currency"),
  };
}
