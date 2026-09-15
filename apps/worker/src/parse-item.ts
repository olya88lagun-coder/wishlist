import { applyParseResult, type Database, getItemForParsing, readParseCache, writeParseCache } from "@wishlist/db";
import { EMPTY_PRODUCT, type FetchedImage, type ParseResult } from "@wishlist/parser";
import { itemImageKey, toWebp } from "./images";
import type { Logger } from "./log";
import { IMMUTABLE_CACHE_CONTROL, type ObjectStorage } from "./storage";

export type ParseItemDeps = {
  db: Database;
  parse(url: string): Promise<ParseResult>;
  fetchImage(url: string): Promise<FetchedImage>;
  images: { storage: ObjectStorage; bucket: string } | null;
  log: Logger;
};

async function parseWithCache(url: string, deps: ParseItemDeps): Promise<ParseResult> {
  const cached = await readParseCache(deps.db, url);
  if (cached) return cached as ParseResult;
  let result: ParseResult;
  try {
    result = await deps.parse(url);
  } catch (error) {
    deps.log("error", "parser crashed", { url, error: String(error) });
    result = { ...EMPTY_PRODUCT, status: "failed", finalUrl: url, store: "other" };
  }
  if (result.status !== "failed") await writeParseCache(deps.db, url, result);
  return result;
}

async function storeImage(itemId: string, imageUrl: string, deps: ParseItemDeps): Promise<string | null> {
  if (!deps.images) return null;
  try {
    const image = await deps.fetchImage(imageUrl);
    if (!image.ok) {
      deps.log("warn", "image not loaded", { itemId, imageUrl, reason: image.reason });
      return null;
    }
    const key = itemImageKey(itemId);
    await deps.images.storage.put(deps.images.bucket, key, await toWebp(image.bytes), { contentType: "image/webp", cacheControl: IMMUTABLE_CACHE_CONTROL });
    return key;
  } catch (error) {
    deps.log("warn", "image not stored", { itemId, imageUrl, error: String(error) });
    return null;
  }
}

export async function runParseItem(itemId: string, deps: ParseItemDeps): Promise<"applied" | "skipped"> {
  const item = await getItemForParsing(deps.db, itemId);
  if (!item) return "skipped";

  const result = await parseWithCache(item.sourceUrl, deps);
  const imageKey = !item.hasImage && result.imageUrl ? await storeImage(item.id, result.imageUrl, deps) : null;

  const applied = await applyParseResult(deps.db, item.id, item.sourceUrl, {
    normalizedUrl: result.finalUrl,
    store: result.store,
    title: result.title,
    description: result.description,
    priceKopecks: result.priceKopecks,
    imageKey,
  });
  // Пока грузилось фото, владелец мог сменить ссылку или удалить подарок — загруженный файл больше никому не нужен
  if (!applied && imageKey && deps.images) await deps.images.storage.remove(deps.images.bucket, [imageKey]);
  deps.log("info", "item parsed", { itemId, store: result.store, status: result.status, applied, withImage: imageKey !== null });
  return applied ? "applied" : "skipped";
}
