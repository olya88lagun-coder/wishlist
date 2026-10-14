// IndexNow сообщает поисковикам (Яндекс, Bing) об адресах страниц, чтобы они зашли на сайт раньше обычного обхода.
// Ключ публичный по протоколу: тот же текст лежит в файле public/<ключ>.txt, так поисковик убеждается, что сайт наш.
// Модуль без алиасов и enum, потому что его запускает напрямую scripts/indexnow.ts под Node.
export const INDEXNOW_KEY = "569d636e910c85d6e4cd4a282c6bcb1d";
export const INDEXNOW_ENDPOINT = "https://yandex.com/indexnow";

// Предел протокола на один запрос
const MAX_URLS_PER_REQUEST = 10_000;

export type IndexNowPayload = {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
};

export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1] ?? "").filter(Boolean);
}

export function indexNowPayload(host: string, key: string, urls: readonly string[]): IndexNowPayload {
  const own = urls.filter((url) => {
    try {
      return new URL(url).host === host;
    } catch {
      return false;
    }
  });
  return { host, key, keyLocation: `https://${host}/${key}.txt`, urlList: own.slice(0, MAX_URLS_PER_REQUEST) };
}
