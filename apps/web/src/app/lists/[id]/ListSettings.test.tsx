import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("./actions", () => ({ updateListAction: vi.fn(), deleteListAction: vi.fn() }));

import { ListSettings } from "./ListSettings";

const wishlist = { id: "list-1", title: "Для Таюшки", occasion: "birthday" as const, eventDate: null };

test("list settings preselect the saved audience", () => {
  const html = renderToStaticMarkup(<ListSettings wishlist={{ ...wishlist, audience: "child" }} />);
  expect(html).toContain('for="list-audience"');
  expect(html).toMatch(/<option value="child" selected="">Для ребёнка<\/option>/);
});

test("an unspecified audience stays on the neutral choice", () => {
  const html = renderToStaticMarkup(<ListSettings wishlist={{ ...wishlist, audience: null }} />);
  expect(html).toMatch(/<option value="" selected="">Не указывать<\/option>/);
});
