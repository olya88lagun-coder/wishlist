import Link from "next/link";
import type { ReactNode } from "react";
import { EditorialMenu } from "@/components/EditorialMenu";
import { SiteFooter } from "@/components/SiteFooter";

export default function GiftsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="editorial-shell">
      <header className="editorial-header">
        <Link className="editorial-brand" href="/">MyWishList</Link>
        <nav aria-label="Разделы сайта">
          <Link href="/">Главная</Link>
          <EditorialMenu />
          <Link href="/#how">Как это работает</Link>
          <Link href="/#about">О нас</Link>
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