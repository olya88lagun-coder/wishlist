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
