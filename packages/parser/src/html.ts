import { type HTMLElement, parse } from "node-html-parser";

export type HtmlRoot = HTMLElement;

// Текст <script> нужен сырым (JSON-LD); атрибуты и текст node-html-parser отдаёт с декодированными сущностями
export function parseHtml(html: string): HtmlRoot {
  return parse(html, { comment: false, blockTextElements: { script: true, style: false, noscript: false, pre: false } });
}
