import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("./TelegramLoginButton", () => ({ TelegramLoginButton: () => null }));

import { LoginOptions } from "./LoginOptions";

test("login for the Ded Moroz letter talks about the letter, not a gift collection", () => {
  const html = renderToStaticMarkup(<LoginOptions botUsername="bot" returnTo="/lists?preset=ded-moroz" />);
  expect(html).toContain("откроется новое письмо Деду Морозу");
  expect(html).toContain('href="/wishlist/pismo-dedu-morozu"');
  expect(html).not.toContain("подборк");
  expect(html).toContain(`returnTo=${encodeURIComponent("/lists?preset=ded-moroz")}`);
});

test("login from a gift collection still offers the way back to it", () => {
  const html = renderToStaticMarkup(<LoginOptions botUsername="bot" returnTo="/gifts/new-year" />);
  expect(html).toContain("вернётесь к подборке");
  expect(html).toContain('href="/gifts/new-year#gift-finder"');
});
