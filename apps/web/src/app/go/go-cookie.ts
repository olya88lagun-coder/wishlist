import { createHash } from "node:crypto";

export const GO_COOKIE_MAX_AGE_SECONDS = 86400;

// Один переход на подарок от одного браузера в сутки; на сервере ничего о госте не храним
export function goCookieName(itemId: string): string {
  return `wl_go_${itemId.replace(/-/g, "").slice(0, 12)}`;
}

export function isSafeRedirect(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

// Повторные клики по той же идее от одного браузера не считаем; имя ничего не раскрывает
export function searchCookieName(store: string, query: string): string {
  const hash = createHash("sha256").update(`${store}:${query.trim().toLowerCase()}`).digest("hex").slice(0, 12);
  return `wl_gs_${hash}`;
}
