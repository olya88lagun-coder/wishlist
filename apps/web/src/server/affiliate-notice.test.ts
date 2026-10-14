import { afterEach, expect, test } from "vitest";
import { isAffiliateEnabled } from "./affiliate-notice";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

test("affiliate links are advertising only while some partner template is configured", () => {
  for (const name of Object.keys(process.env)) if (name.startsWith("AFFILIATE_")) delete process.env[name];
  expect(isAffiliateEnabled()).toBe(false);

  process.env.AFFILIATE_OZON_TEMPLATE = "https://ad.example/?ulp={url}";
  expect(isAffiliateEnabled()).toBe(true);

  process.env.AFFILIATE_OZON_TEMPLATE = "   ";
  expect(isAffiliateEnabled()).toBe(false);
});
