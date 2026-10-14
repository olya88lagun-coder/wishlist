import { afterEach, expect, test } from "vitest";
import { enabledExtraStores } from "./store-routing";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

test("an extra store is offered only while its partner template is configured", () => {
  for (const name of ["AFFILIATE_CHITAIGOROD_TEMPLATE", "AFFILIATE_LAMODA_TEMPLATE", "AFFILIATE_ALIEXPRESS_TEMPLATE"]) delete process.env[name];
  expect(enabledExtraStores()).toEqual([]);

  process.env.AFFILIATE_CHITAIGOROD_TEMPLATE = "https://ad.example/g/CODE/?ulp={url}";
  process.env.AFFILIATE_ALIEXPRESS_TEMPLATE = "   ";
  expect(enabledExtraStores()).toEqual(["chitaigorod"]);

  process.env.AFFILIATE_LAMODA_TEMPLATE = "https://ad.example/g/CODE2/?ulp={url}";
  expect(enabledExtraStores()).toEqual(["chitaigorod", "lamoda"]);
});
