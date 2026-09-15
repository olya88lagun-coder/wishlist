import { detectStore, normalizeProductUrl, type StoreId } from "@wishlist/core";
import { extractJsonLdProduct } from "./extract/jsonld";
import { extractMicrodata } from "./extract/microdata";
import { extractOpenGraph } from "./extract/opengraph";
import { parseHtml } from "./html";
import { mergeProduct, statusFor } from "./merge";
import { titleFromUrlSlug } from "./slug-title";
import { STORE_STRATEGIES } from "./strategies";
import { EMPTY_PRODUCT, type FetchedPage, type FetchPage, type ParseResult } from "./types";

export type ParseDeps = { fetchPage: FetchPage; waitTurn?: (url: string) => Promise<void> };

function fromSlug(url: string, store: StoreId): ParseResult {
  const title = titleFromUrlSlug(url, store);
  return { ...EMPTY_PRODUCT, title, status: title ? "partial" : "failed", finalUrl: url, store };
}

const ANTIBOT_PATH = /captcha/i;

// Антибот отвечает 200 на своей странице (у Маркета — /showcaptcha с og:title «Яндекс»): это не товар
function isAntibotPage(page: FetchedPage): boolean {
  return page.ok && ANTIBOT_PATH.test(new URL(page.url).pathname);
}

function fromPage(url: string, body: string, store: StoreId): ParseResult {
  const root = parseHtml(body);
  const jsonLd = extractJsonLdProduct(root);
  const merged = mergeProduct(url, [jsonLd, extractMicrodata(root), extractOpenGraph(root)]);
  const priceFrom = STORE_STRATEGIES[store].priceFrom;
  const trustedPrice = priceFrom === "any" ? merged : priceFrom === "jsonld" ? mergeProduct(url, [jsonLd]) : { priceKopecks: null, currency: null };
  const priced = { ...merged, priceKopecks: trustedPrice.priceKopecks, currency: trustedPrice.currency };
  const product = priced.title ? priced : { ...priced, title: titleFromUrlSlug(url, store) };
  return { ...product, status: statusFor(product), finalUrl: url, store };
}

async function load(url: string, userAgent: string, deps: ParseDeps): Promise<FetchedPage> {
  await deps.waitTurn?.(url);
  return deps.fetchPage(url, { userAgent });
}

export async function parseProduct(rawUrl: string, deps: ParseDeps): Promise<ParseResult> {
  const url = normalizeProductUrl(rawUrl);
  if (!url) return { ...EMPTY_PRODUCT, status: "failed", finalUrl: rawUrl, store: "other" };

  const store = detectStore(url).id;
  const strategy = STORE_STRATEGIES[store];
  if (!strategy.fetch) return fromSlug(url, store);

  const page = await load(url, strategy.userAgent, deps);
  if (!page.ok || isAntibotPage(page)) return fromSlug(url, store);

  const finalUrl = normalizeProductUrl(page.url) ?? url;
  const finalStore = detectStore(finalUrl).id;
  if (finalStore === store) return fromPage(finalUrl, page.body, store);

  const finalStrategy = STORE_STRATEGIES[finalStore];
  if (!finalStrategy.fetch) return fromSlug(finalUrl, finalStore);
  if (finalStrategy.userAgent === strategy.userAgent) return fromPage(finalUrl, page.body, finalStore);

  const refetched = await load(finalUrl, finalStrategy.userAgent, deps);
  return refetched.ok && !isAntibotPage(refetched) ? fromPage(finalUrl, refetched.body, finalStore) : fromSlug(finalUrl, finalStore);
}
