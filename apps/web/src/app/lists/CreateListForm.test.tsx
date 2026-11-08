import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("./actions", () => ({ createListAction: vi.fn() }));

import { CreateListForm } from "./CreateListForm";

test("the create form asks whom the list is for, optionally, with three clear choices", () => {
  const html = renderToStaticMarkup(<CreateListForm defaultOpen />);
  expect(html).toContain('for="audience"');
  expect(html).toContain("Для кого список");
  const select = html.match(/<select[^>]*name="audience"[^>]*>[\s\S]*?<\/select>/)?.[0] ?? "";
  expect(select).not.toContain("required");
  expect(select).toContain('<option value="" selected="">Не указывать</option>');
  expect(select).toContain('<option value="adult">Для взрослого</option>');
  expect(select).toContain('<option value="child">Для ребёнка</option>');
});

test("the Ded Moroz preset prefills a New Year list for a child", () => {
  const html = renderToStaticMarkup(<CreateListForm defaultOpen preset={{ title: "Письмо Деду Морозу", occasion: "new_year", audience: "child", eventDate: "2026-12-31" }} />);
  expect(html).toContain('value="Письмо Деду Морозу"');
  expect(html).toContain('<option value="new_year" selected="">Новый год</option>');
  expect(html).toContain('<option value="child" selected="">Для ребёнка</option>');
  expect(html).toContain('value="2026-12-31"');
});
