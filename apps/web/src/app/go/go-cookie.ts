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
