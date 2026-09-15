import type { StoreId } from "@wishlist/core";

export type ParseStatus = "ok" | "partial" | "failed";

export type ParsedProduct = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  priceKopecks: number | null;
  currency: string | null;
};

export type ParseResult = ParsedProduct & { status: ParseStatus; finalUrl: string; store: StoreId };

export type FetchFailureReason = "blocked" | "timeout" | "http_error" | "too_large" | "network" | "not_html" | "not_image";
export type FetchFailure = { ok: false; reason: FetchFailureReason; status?: number };

export type FetchedPage = { ok: true; url: string; status: number; body: string } | FetchFailure;
export type FetchedImage = { ok: true; bytes: Uint8Array; contentType: string } | FetchFailure;

export type FetchPage = (url: string, options: { userAgent: string }) => Promise<FetchedPage>;

export const EMPTY_PRODUCT: ParsedProduct = { title: null, description: null, imageUrl: null, priceKopecks: null, currency: null };
