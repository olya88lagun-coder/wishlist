import type { Metadata } from "next";

// Страницы игры доступны только участникам по ссылкам: в поиске им не место
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SantaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
