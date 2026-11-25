import { expect, test } from "vitest";
import {
  COOKIE_CONSENT_KEY,
  analyticsConsentGranted,
  isCookieConsentValue,
  readCookieConsent,
  writeCookieConsent,
} from "./cookie-consent";

function memoryStorage(initial?: Record<string, string>) {
  const map = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
    map,
  };
}

test("only accepted and rejected are valid consent values", () => {
  expect(isCookieConsentValue("accepted")).toBe(true);
  expect(isCookieConsentValue("rejected")).toBe(true);
  expect(isCookieConsentValue("1")).toBe(false);
  expect(isCookieConsentValue(null)).toBe(false);
});

test("read and write round-trip through storage", () => {
  const storage = memoryStorage();
  expect(readCookieConsent(storage)).toBeNull();
  writeCookieConsent("accepted", storage);
  expect(storage.map.get(COOKIE_CONSENT_KEY)).toBe("accepted");
  expect(readCookieConsent(storage)).toBe("accepted");
  expect(analyticsConsentGranted(readCookieConsent(storage))).toBe(true);
  writeCookieConsent("rejected", storage);
  expect(analyticsConsentGranted(readCookieConsent(storage))).toBe(false);
});

test("blocked storage does not throw", () => {
  const storage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
  };
  expect(readCookieConsent(storage)).toBeNull();
  expect(() => writeCookieConsent("accepted", storage)).not.toThrow();
});
