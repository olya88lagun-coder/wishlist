import type { ReactNode } from "react";

export function CelebrationHeading({ title, ownerName, eventDate, preview = false, children }: {
  title: string; ownerName?: string; eventDate?: string | null; preview?: boolean; children?: ReactNode;
}) {
  const Title = preview ? "h2" : "h1";
  const date = eventDate ? new Date(`${eventDate}T12:00:00Z`) : null;
  const dateLabel = date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(date) : null;
  return <header className="celebration-heading">
    <div className="celebration-heading__content">
      <p className="celebration-heading__kicker">{ownerName ? `список ${ownerName}` : "Праздник"}</p>
      <Title className="display">{title}</Title>
      <div className="celebration-heading__rule" aria-hidden="true"><span />✦<span /></div>
      {(dateLabel || children) && <div className="celebration-heading__date">
        {dateLabel && <time dateTime={eventDate!}>{dateLabel}</time>}{children}
      </div>}
    </div>
  </header>;
}
