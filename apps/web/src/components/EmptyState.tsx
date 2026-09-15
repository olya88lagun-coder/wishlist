import type { ReactNode } from "react";

export function EmptyState({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <section className="panel stack" style={{ textAlign: "center", padding: "28px 18px" }}>
      <h2 className="serif" style={{ margin: 0, fontSize: 26, fontWeight: 500 }}>{title}</h2>
      <p className="muted" style={{ margin: 0 }}>{text}</p>
      {children}
    </section>
  );
}
