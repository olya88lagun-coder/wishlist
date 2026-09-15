import { countdownLabel, daysUntil, type Occasion } from "@wishlist/core";

export function CountdownSticker({ occasion, eventDate, now = new Date() }: { occasion: Occasion; eventDate: string | null; now?: Date }) {
  const days = daysUntil(eventDate, now);
  if (days === null) return null;
  return <span className="sticker sticker--countdown">{countdownLabel(occasion, days)}</span>;
}
