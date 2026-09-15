import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { checkTarget, createSafeFetcher, guardedLookup, isPublicAddress, preferIpv6 } from "./safe-fetch";

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

test("preferIpv6 puts IPv6 addresses first and keeps IPv4 as fallback", () => {
  const v4 = { address: "185.62.202.2", family: 4 };
  const v6 = { address: "2a03:720::173:2", family: 6 };
  expect(preferIpv6([v4, v6])).toEqual([v6, v4]);
  expect(preferIpv6([v4])).toEqual([v4]);
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
