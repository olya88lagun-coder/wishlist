import type { HtmlRoot } from "../html";
import { toKopecks } from "../price";
import type { ParsedProduct } from "../types";

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);

function* nodes(value: unknown): Generator<JsonObject> {
  if (Array.isArray(value)) {
    for (const entry of value) yield* nodes(entry);
    return;
  }
  if (!isObject(value)) return;
  yield value;
  if (value["@graph"] !== undefined) yield* nodes(value["@graph"]);
}

function isProduct(node: JsonObject): boolean {
  const type = node["@type"];
  return type === "Product" || (Array.isArray(type) && type.includes("Product"));
}

function firstText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() === "" ? null : value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = firstText(entry);
      if (text) return text;
    }
    return null;
  }
  if (isObject(value)) return firstText(value.url ?? value.contentUrl);
  return null;
}

function offerPrice(offers: unknown): Pick<ParsedProduct, "priceKopecks" | "currency"> {
  for (const offer of Array.isArray(offers) ? offers : [offers]) {
    if (!isObject(offer)) continue;
    const specification = isObject(offer.priceSpecification) ? offer.priceSpecification.price : undefined;
    const priceKopecks = toKopecks(offer.price ?? offer.lowPrice ?? specification);
    if (priceKopecks !== null) return { priceKopecks, currency: typeof offer.priceCurrency === "string" ? offer.priceCurrency : null };
  }
  return { priceKopecks: null, currency: null };
}

export function extractJsonLdProduct(root: HtmlRoot): Partial<ParsedProduct> {
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(script.rawText);
    } catch {
      continue;
    }
    for (const node of nodes(data)) {
      if (!isProduct(node)) continue;
      return { title: firstText(node.name), description: firstText(node.description), imageUrl: firstText(node.image), ...offerPrice(node.offers) };
    }
  }
  return {};
}
