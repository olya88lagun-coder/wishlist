export const COOKIE_CONSENT_KEY = "wl_cookie_consent";
export type CookieConsentValue = "accepted" | "rejected";

export function isCookieConsentValue(value: string | null | undefined): value is CookieConsentValue {
  return value === "accepted" || value === "rejected";
}

export function readCookieConsent(storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage): CookieConsentValue | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(COOKIE_CONSENT_KEY);
    return isCookieConsentValue(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeCookieConsent(value: CookieConsentValue, storage: Pick<Storage, "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage): void {
  if (!storage) return;
  try {
    storage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    /* приватный режим: выбор живёт только в памяти вкладки */
  }
}

export function analyticsConsentGranted(value: CookieConsentValue | null = readCookieConsent()): boolean {
  return value === "accepted";
}
