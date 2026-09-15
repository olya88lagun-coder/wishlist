# Task 3: Безопасная загрузка страниц и фото

**Files:**
- Create: `packages/parser/src/safe-fetch.ts`, `packages/parser/src/throttle.ts`
- Modify: `packages/parser/src/index.ts`
- Test: `packages/parser/src/safe-fetch.test.ts`, `packages/parser/src/throttle.test.ts`

**Interfaces:**
- Consumes: `FetchedPage`, `FetchedImage`, `FetchFailure`, `FetchFailureReason`, `FetchPage` (Task 1).
- Produces:
  ```ts
  // safe-fetch.ts
  function isPublicAddress(address: string): boolean;
  function checkTarget(rawUrl: string, allowPrivateNetworks?: boolean): string | null;   // нормализованный URL или null, если идти туда нельзя
  function guardedLookup(hostname: string, options: { all?: boolean; family?: number }, callback: LookupCallback): void;
  type SafeFetchOptions = { timeoutMs?: number; maxPageBytes?: number; maxImageBytes?: number; maxRedirects?: number; allowPrivateNetworks?: boolean };
  type SafeFetcher = { fetchPage: FetchPage; fetchImage(url: string): Promise<FetchedImage>; close(): Promise<void> };
  function createSafeFetcher(options?: SafeFetchOptions): SafeFetcher;
  const IMAGE_USER_AGENT: string;
  // throttle.ts
  type Clock = { now(): number; sleep(ms: number): Promise<void> };
  function createHostThrottle(minIntervalMs: number, clock?: Clock): (url: string) => Promise<void>;
  ```
- Значения по умолчанию: `timeoutMs` 15 000 (на весь запрос вместе с редиректами), `maxPageBytes` 4 МБ, `maxImageBytes` 8 МБ, `maxRedirects` 5.

**Почему так.** Владелец может вставить любую ссылку, и воркер пойдёт по ней из нашей сети. Без защиты это SSRF: `http://169.254.169.254/` (метаданные облака), `http://db:5432`, `http://127.0.0.1`. Защита в два слоя: `checkTarget` отбрасывает схемы, порты, `localhost` и литеральные приватные IP до запроса (DNS для литеральных IP не вызывается), а `guardedLookup` в `undici.Agent` проверяет **все** адреса, в которые резолвится имя, в момент подключения — это закрывает DNS rebinding. Редиректы обрабатываются вручную, и каждый новый адрес снова проходит `checkTarget`.

- [ ] **Step 1: Тесты загрузчика**

`packages/parser/src/safe-fetch.test.ts`:
```ts
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { checkTarget, createSafeFetcher, guardedLookup, isPublicAddress } from "./safe-fetch";

describe("isPublicAddress", () => {
  test.each([
    ["93.158.134.3", true],
    ["2a02:6b8::2:242", true],
    ["127.0.0.1", false],
    ["10.1.2.3", false],
    ["172.18.0.5", false],
    ["192.168.1.1", false],
    ["169.254.169.254", false],
    ["100.64.0.1", false],
    ["0.0.0.0", false],
    ["::1", false],
    ["fd00::1", false],
    ["fe80::1", false],
    ["::ffff:127.0.0.1", false],
    ["not-an-ip", false],
  ])("%s → %s", (address, expected) => {
    expect(isPublicAddress(address)).toBe(expected);
  });
});

describe("checkTarget", () => {
  test("allows public http(s) on default ports", () => {
    expect(checkTarget("https://www.wildberries.ru/catalog/1/detail.aspx")).toBe("https://www.wildberries.ru/catalog/1/detail.aspx");
    expect(checkTarget("http://example.com:80/a")).toBe("http://example.com/a");
  });

  test.each([
    "ftp://example.com/file",
    "file:///etc/passwd",
    "https://example.com:8443/",
    "http://localhost/",
    "http://api.localhost/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://10.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://user:pass@example.com/",
    "не ссылка",
  ])("blocks %s", (url) => {
    expect(checkTarget(url)).toBeNull();
  });

  test("test mode allows loopback with any port", () => {
    expect(checkTarget("http://127.0.0.1:4000/x", true)).toBe("http://127.0.0.1:4000/x");
  });
});

describe("guardedLookup", () => {
  test("refuses names that resolve to private addresses", async () => {
    const error = await new Promise<NodeJS.ErrnoException | null>((resolve) => guardedLookup("localhost", { all: true }, (err) => resolve(err)));
    expect(error?.code).toBe("EBLOCKED");
  });
});

describe("createSafeFetcher", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/page") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(`<title>Страница</title><p>${req.headers["user-agent"]}</p>`);
      } else if (req.url === "/redirect") {
        res.writeHead(302, { location: "/page" });
        res.end();
      } else if (req.url === "/loop") {
        res.writeHead(302, { location: "/loop" });
        res.end();
      } else if (req.url === "/big") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("x".repeat(2048));
      } else if (req.url === "/slow") {
        setTimeout(() => res.end("late"), 1500);
      } else if (req.url === "/json") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
      } else if (req.url === "/image") {
        res.writeHead(200, { "content-type": "image/png" });
        res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test("blocks loopback by default without touching the network", async () => {
    const fetcher = createSafeFetcher();
    expect(await fetcher.fetchPage(`${base}/page`, { userAgent: "test" })).toEqual({ ok: false, reason: "blocked" });
    await fetcher.close();
  });

  test("loads html with the given user agent and follows redirects", async () => {
    const fetcher = createSafeFetcher({ allowPrivateNetworks: true });
    const page = await fetcher.fetchPage(`${base}/redirect`, { userAgent: "WhatsApp/2.23.20.0" });
    expect(page).toEqual({ ok: true, url: `${base}/page`, status: 200, body: "<title>Страница</title><p>WhatsApp/2.23.20.0</p>" });
    await fetcher.close();
  });

  test("reports http errors, redirect loops, non-html, size and time limits", async () => {
    const fetcher = createSafeFetcher({ allowPrivateNetworks: true, maxPageBytes: 1024, timeoutMs: 500, maxRedirects: 3 });
    expect(await fetcher.fetchPage(`${base}/missing`, { userAgent: "t" })).toEqual({ ok: false, reason: "http_error", status: 404 });
    expect(await fetcher.fetchPage(`${base}/loop`, { userAgent: "t" })).toEqual({ ok: false, reason: "http_error", status: 302 });
    expect(await fetcher.fetchPage(`${base}/json`, { userAgent: "t" })).toEqual({ ok: false, reason: "not_html" });
    expect(await fetcher.fetchPage(`${base}/big`, { userAgent: "t" })).toEqual({ ok: false, reason: "too_large" });
    expect(await fetcher.fetchPage(`${base}/slow`, { userAgent: "t" })).toEqual({ ok: false, reason: "timeout" });
    await fetcher.close();
  });

  test("loads images and refuses non-images", async () => {
    const fetcher = createSafeFetcher({ allowPrivateNetworks: true });
    expect(await fetcher.fetchImage(`${base}/image`)).toEqual({ ok: true, bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), contentType: "image/png" });
    expect(await fetcher.fetchImage(`${base}/page`)).toEqual({ ok: false, reason: "not_image" });
    await fetcher.close();
  });
});
```

Run: `pnpm vitest run packages/parser/src/safe-fetch.test.ts`
Expected: FAIL — `Cannot find module './safe-fetch'`.

- [ ] **Step 2: Реализация загрузчика**

`packages/parser/src/safe-fetch.ts`:
```ts
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

export function guardedLookup(hostname: string, options: { all?: boolean; family?: number }, callback: LookupCallback): void {
  dnsLookup(hostname, { family: options.family ?? 0, all: true }, (error, addresses) => {
    if (error) return callback(error, options.all ? [] : "");
    // пропускаем имя, только если все его адреса публичные: иначе атакующий DNS мог бы подмешать внутренний
    if (addresses.length === 0 || !addresses.every((entry) => isPublicAddress(entry.address))) {
      return callback(Object.assign(new Error(`blocked address for ${hostname}`), { code: "EBLOCKED" }), options.all ? [] : "");
    }
    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0]!.address, addresses[0]!.family);
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
```

Run: `pnpm vitest run packages/parser/src/safe-fetch.test.ts`
Expected: PASS. Если тест таймаута даёт `network` вместо `timeout` — вывести `console.log(error, error.cause)` в `reasonOf` один раз, посмотреть фактическое имя/код ошибки undici 8 и добавить его в проверку; отладочный вывод удалить.

- [ ] **Step 3: Пауза между запросами к одному домену (тест → реализация)**

`packages/parser/src/throttle.test.ts`:
```ts
import { expect, test } from "vitest";
import { createHostThrottle } from "./throttle";

// Время стоит на месте: так видно, на сколько каждый вызов откладывается относительно одного момента
function fakeClock() {
  const sleeps: number[] = [];
  return {
    sleeps,
    clock: {
      now: () => 1_000_000,
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
    },
  };
}

test("spaces requests to the same host and lets other hosts through", async () => {
  const { clock, sleeps } = fakeClock();
  const waitTurn = createHostThrottle(2000, clock);

  await waitTurn("https://www.wildberries.ru/catalog/1/detail.aspx");
  await waitTurn("https://goldapple.ru/1");
  await waitTurn("https://www.wildberries.ru/catalog/2/detail.aspx");

  expect(sleeps).toEqual([2000]);
});

test("concurrent callers for one host queue up one interval apart", async () => {
  const { clock, sleeps } = fakeClock();
  const waitTurn = createHostThrottle(2000, clock);

  await Promise.all([waitTurn("https://a.ru/1"), waitTurn("https://a.ru/2"), waitTurn("https://a.ru/3")]);

  expect(sleeps).toEqual([2000, 4000]);
});
```

Run: `pnpm vitest run packages/parser/src/throttle.test.ts`
Expected: FAIL — `Cannot find module './throttle'`.

`packages/parser/src/throttle.ts`:
```ts
export type Clock = { now(): number; sleep(ms: number): Promise<void> };

const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const PRUNE_THRESHOLD = 500;

export function createHostThrottle(minIntervalMs: number, clock: Clock = systemClock): (url: string) => Promise<void> {
  const nextSlot = new Map<string, number>();
  return async (url) => {
    const host = new URL(url).hostname;
    const now = clock.now();
    if (nextSlot.size > PRUNE_THRESHOLD) {
      for (const [key, slot] of nextSlot) if (slot < now) nextSlot.delete(key);
    }
    // слот резервируется синхронно, до ожидания, поэтому параллельные вызовы выстраиваются в очередь
    const slot = Math.max(now, nextSlot.get(host) ?? 0);
    nextSlot.set(host, slot + minIntervalMs);
    if (slot > now) await clock.sleep(slot - now);
  };
}
```

Run: `pnpm vitest run packages/parser/src/throttle.test.ts`
Expected: PASS.

- [ ] **Step 4: Экспорт, проверка, commit**

В `packages/parser/src/index.ts` добавить строки:
```ts
export * from "./safe-fetch";
export * from "./throttle";
```

Run: `pnpm vitest run packages/parser && pnpm typecheck`
Expected: PASS.

```bash
git add packages/parser
git commit -m "feat(parser): SSRF-safe page and image fetcher with per-host throttle"
```
