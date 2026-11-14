import { countdownLabel, daysUntil, type Occasion } from "@wishlist/core";

export function CountdownSticker({ occasion, eventDate, now = new Date() }: { occasion: Occasion; eventDate: string | null; now?: Date }) {
  const days = daysUntil(eventDate, now);
  if (days === null) return null;
  const label = countdownLabel(occasion, days);
  const digits = /\d+/.exec(label);
  if (!digits) return <span className="sticker sticker--countdown">{label}</span>;
  return (
    <span className="sticker sticker--countdown">
      {label.slice(0, digits.index)}
      <span className="countdown-flip">
        {Array.from(digits[0], (digit, index) => <span key={index}>{digit}</span>)}
      </span>
      {label.slice(digits.index + digits[0].length)}
    </span>
  );
}
