import { normalizeProductUrl } from "@wishlist/core";

export const MAX_LINKS_PER_MESSAGE = 5;

export type MessageEntityLike = { type: string; offset: number; length: number; url?: string };

const URL_IN_TEXT = /https?:\/\/[^\s<>"«»]+/gi;
const TRAILING_PUNCTUATION = /[).,!?;:]+$/;

// Смещения сущностей Telegram — в UTF-16, как и индексы строк JS, поэтому slice попадает точно
function candidates(text: string, entities: readonly MessageEntityLike[]): string[] {
  const fromEntities = entities.flatMap((entity) => {
    if (entity.type === "text_link" && entity.url) return [entity.url];
    if (entity.type === "url") return [text.slice(entity.offset, entity.offset + entity.length)];
    return [];
  });
  return fromEntities.length > 0 ? fromEntities : (text.match(URL_IN_TEXT) ?? []);
}

export function extractLinks(text: string, entities: readonly MessageEntityLike[] = []): string[] {
  const links: string[] = [];
  for (const raw of candidates(text, entities)) {
    const trimmed = raw.replace(TRAILING_PUNCTUATION, "");
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = normalizeProductUrl(withScheme);
    if (url && !links.includes(url)) links.push(url);
    if (links.length === MAX_LINKS_PER_MESSAGE) break;
  }
  return links;
}
