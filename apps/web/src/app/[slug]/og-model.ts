import { countdownLabel, daysUntil, pluralRu } from "@wishlist/core";
import type { PublicWishlistView } from "@wishlist/db";

export const OG_TITLE_MAX = 60;
const GIFT_FORMS = ["подарок", "подарка", "подарков"] as const;

export type OgModel = { eyebrow: string; title: string; items: string; countdown: string | null };

// Родительный падеж для имён на -а/-я («список Маши»); остальные имена показываем через двоеточие
function ownerEyebrow(ownerName: string): string {
  if (/[ая]$/i.test(ownerName)) return `список ${ownerName.slice(0, -1)}и`;
  return `список: ${ownerName}`;
}

function cut(title: string, max: number): string {
  const trimmed = title.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  const head = trimmed.slice(0, max);
  const lastSpace = head.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? head.slice(0, lastSpace) : head).trimEnd()}…`;
}

export function ogModel(view: Pick<PublicWishlistView, "wishlist" | "ownerName" | "items">, now: Date): OgModel {
  const count = view.items.length;
  const days = daysUntil(view.wishlist.eventDate, now);
  return {
    eyebrow: ownerEyebrow(view.ownerName),
    title: cut(view.wishlist.title, OG_TITLE_MAX),
    items: count === 0 ? "пока без подарков" : `${count} ${pluralRu(count, GIFT_FORMS)}`,
    countdown: days === null ? null : countdownLabel(view.wishlist.occasion, days),
  };
}
