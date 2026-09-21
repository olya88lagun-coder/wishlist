import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";

export default function ArticlesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="editorial-shell">
      <header className="editorial-header">
        <Link className="editorial-brand" href="/">MyWishList</Link>
        <nav aria-label="Разделы сайта">
          <Link href="/">Главная</Link>
          <Link href="/articles">Статьи</Link>
          <Link href="/#how-it-works">Как это работает</Link>
        </nav>
        <Link className="editorial-create" href="/lists">Создать список</Link>
      </header>
      {children}
      <div className="editorial-footer">
        <SiteFooter />
      </div>
    </div>
  );
}
