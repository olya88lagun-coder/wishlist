import type { ReactNode } from "react";

export function OwnerPageHeader({ eyebrow, title, description, actions }: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="owner-hero" aria-labelledby="owner-page-title">
      <div className="owner-hero__copy">
        <p className="owner-hero__eyebrow">{eyebrow}</p>
        <h1 id="owner-page-title" className="owner-hero__title">{title}</h1>
        {description && <p className="owner-hero__description">{description}</p>}
      </div>
      {actions && <div className="owner-hero__actions">{actions}</div>}
    </header>
  );
}
