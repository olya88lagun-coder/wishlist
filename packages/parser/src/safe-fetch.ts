import { type LookupAddress, lookup as dnsLookup } from "node:dns";
import type { LookupFunction } from "node:net";
import type { ReadableStream } from "node:stream/web";
import ipaddr from "ipaddr.js";
import { Agent, fetch } from "undici";
import type { FetchedImage, FetchedPage, FetchFailure, FetchFailureReason, FetchPage } from "./types";

export const IMAGE_USER_AGENT = "Mozilla/5.0 (compatible; WishlistImageBot/1.0; +https://my-wish-list.online)";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_PAGE_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_PORTS = new Set(["", "80", "443"]);

export type SafeFetchOptions = { timeoutMs?: number; maxPageBytes?: number; maxImageBytes?: number; maxRedirects?: number; allowPrivateNetworks?: boolean };
export type SafeFetcher = { fetchPage: FetchPage; fetchImage(url: string): Promise<FetchedImage>; close(): Promise<void> };
type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  let parsed = ipaddr.parse(address);
  if (parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) parsed = (parsed as ipaddr.IPv6).toIPv4Address();
  return parsed.range() === "unicast";
}

export function checkTarget(rawUrl: string, allowPrivateNetworks = false): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  if (allowPrivateNetworks) return url.toString();
  if (!DEFAULT_PORTS.has(url.port)) return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return null;
  if (ipaddr.isValid(host) && !isPublicAddress(host)) return null;
  return url.toString();
}

// IPv6 первым: IPv4 московского сервера антибот Wildberries отвечает 498, а по IPv6 отдаёт страницу (проверено 2026-09-15)
export function preferIpv6(addresses: LookupAddress[]): LookupAddress[] {
  return [...addresses.filter((entry) => entry.family === 6), ...addresses.filter((entry) => entry.family !== 6)];
}

export function guardedLookup(hostname: string, options: { all?: boolean; family?: number }, callback: LookupCallback): void {
  dnsLookup(hostname, { family: options.family ?? 0, all: true }, (error, addresses) => {
    if (error) return callback(error, options.all ? [] : "");
    // пропускаем имя, только если все его адреса публичные: иначе атакующий DNS мог бы подмешать внутренний
    if (addresses.length === 0 || !addresses.every((entry) => isPublicAddress(entry.address))) {
      return callback(Object.assign(new Error(`blocked address for ${hostname}`), { code: "EBLOCKED" }), options.all ? [] : "");
    }
    const ordered = preferIpv6(addresses);
    if (options.all) return callback(null, ordered);
    return callback(null, ordered[0]!.address, ordered[0]!.family);
  });
}

type RawResponse = { ok: true; url: string; status: number; contentType: string; bytes: Uint8Array };

function failure(reason: FetchFailureReason, status?: number): FetchFailure {
  return status === undefined ? { ok: false, reason } : { ok: false, reason, status };
}

function reasonOf(error: unknown): FetchFailureReason {
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") return "timeout";
  const cause = error instanceof Error ? (error.cause as NodeJS.ErrnoException | undefined) : undefined;
  if (cause?.code === "EBLOCKED") return "blocked";
  if (cause?.name === "TimeoutError" || cause?.code === "UND_ERR_HEADERS_TIMEOUT" || cause?.code === "UND_ERR_BODY_TIMEOUT") return "timeout";
  return "network";
}

async function readLimited(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array | null> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.byteLength;
    if (total > maxBytes) {
      await body.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function decodeText(bytes: Uint8Array, contentType: string): string {
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export function createSafeFetcher(options: SafeFetchOptions = {}): SafeFetcher {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const allowPrivate = options.allowPrivateNetworks ?? false;
  const dispatcher = new Agent({
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
    connect: allowPrivate ? {} : { lookup: guardedLookup as unknown as LookupFunction },
  });

  async function request(startUrl: string, headers: Record<string, string>, maxBytes: number): Promise<RawResponse | FetchFailure> {
    const signal = AbortSignal.timeout(timeoutMs);
    let current = startUrl;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const target = checkTarget(current, allowPrivate);
      if (!target) return failure("blocked");
      try {
        const response = await fetch(target, { dispatcher, redirect: "manual", signal, headers: { "accept-language": "ru-RU,ru;q=0.9", ...headers } });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          if (!location || hop === maxRedirects) return failure("http_error", response.status);
          current = new URL(location, target).toString();
          continue;
        }
        if (!response.ok || !response.body) {
          await response.body?.cancel();
          return failure("http_error", response.status);
        }
        const bytes = await readLimited(response.body, maxBytes);
        if (!bytes) return failure("too_large");
        return { ok: true, url: target, status: response.status, contentType: response.headers.get("content-type") ?? "", bytes };
      } catch (error) {
        return failure(reasonOf(error));
      }
    }
    return failure("http_error");
  }

  return {
    async fetchPage(url, { userAgent }): Promise<FetchedPage> {
      const response = await request(url, { "user-agent": userAgent, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" }, options.maxPageBytes ?? DEFAULT_MAX_PAGE_BYTES);
      if (!response.ok) return response;
      if (response.contentType !== "" && !/html|xml/i.test(response.contentType)) return failure("not_html");
      return { ok: true, url: response.url, status: response.status, body: decodeText(response.bytes, response.contentType) };
    },
    async fetchImage(url): Promise<FetchedImage> {
      const response = await request(url, { "user-agent": IMAGE_USER_AGENT, accept: "image/avif,image/webp,image/*;q=0.8" }, options.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES);
      if (!response.ok) return response;
      if (!response.contentType.toLowerCase().startsWith("image/")) return failure("not_image");
      return { ok: true, bytes: response.bytes, contentType: response.contentType };
    },
    close: () => dispatcher.close(),
  };
}
