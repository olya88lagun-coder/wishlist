export type StoreId = "wildberries" | "ozon" | "goldapple" | "lamoda" | "yandex_market" | "other";
export type StoreInfo = { id: StoreId; label: string };

export const MAX_URL_LENGTH = 2048;

const TRACKING_PARAMS = /^(utm_.*|fbclid|gclid|yclid|_openstat|erid)$/i;

const KNOWN_STORES: { id: Exclude<StoreId, "other">; label: string; hosts: string[] }[] = [
  { id: "wildberries", label: "Wildberries", hosts: ["wildberries.ru", "wb.ru"] },
  { id: "ozon", label: "Ozon", hosts: ["ozon.ru"] },
  { id: "goldapple", label: "Золотое Яблоко", hosts: ["goldapple.ru"] },
  { id: "lamoda", label: "Lamoda", hosts: ["lamoda.ru"] },
  { id: "yandex_market", label: "Яндекс Маркет", hosts: ["market.yandex.ru"] },
];

export function normalizeProductUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  url.hash = "";
  return url.toString();
}

function bareHost(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

export function detectStore(url: string): StoreInfo {
  const host = bareHost(url);
  const known = KNOWN_STORES.find((s) => s.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  return known ? { id: known.id, label: known.label } : { id: "other", label: host };
}
