import type { HTMLElement } from "node-html-parser";
import type { HtmlRoot } from "../html";
import { toKopecks } from "../price";
import type { ParsedProduct } from "../types";

function valueOf(element: HTMLElement | null): string | null {
  if (!element) return null;
  const value = (element.getAttribute("content") ?? element.text).trim();
  return value === "" ? null : value;
}

// Магазины кладут на страницу служебные нулевые цены (у Золотого Яблока — кнопка «цена для гостя»), берём первую настоящую
function firstPositivePrice(root: HtmlRoot): number | null {
  for (const element of root.querySelectorAll('[itemprop="price"], [itemprop="lowPrice"]')) {
    const kopecks = toKopecks(valueOf(element));
    if (kopecks !== null) return kopecks;
  }
  return null;
}

function nearestScope(element: HTMLElement): HTMLElement | null {
  let current = element.parentNode;
  while (current && !current.hasAttribute("itemscope")) current = current.parentNode;
  return current;
}

// name берём только у самого товара: внутри Product бывают хлебные крошки, бренд и предложения со своими name
function productName(root: HtmlRoot): string | null {
  for (const product of root.querySelectorAll('[itemtype*="schema.org/Product"]')) {
    const own = product.querySelectorAll('[itemprop="name"]').find((element) => nearestScope(element) === product);
    const name = valueOf(own ?? null);
    if (name) return name;
  }
  return null;
}

export function extractMicrodata(root: HtmlRoot): Partial<ParsedProduct> {
  return {
    title: productName(root),
    priceKopecks: firstPositivePrice(root),
    currency: valueOf(root.querySelector('[itemprop="priceCurrency"]')),
  };
}
