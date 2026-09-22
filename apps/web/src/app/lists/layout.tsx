import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { EditorialMenu } from "@/components/EditorialMenu";
import "./owner.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NoIndexLayout({ children }: { children: ReactNode }) {
  return (
    <div className="owner-shell">
      <header className="owner-topbar">
        <Link className="owner-brand" href="/">MyWishList</Link>
        <nav aria-label="Разделы сайта">
          <Link href="/">Главная</Link>
          <EditorialMenu />
          <Link href="/#how">Как это работает</Link>
          <Link href="/#about">О нас</Link>
        </nav>
        <Link className="owner-topbar__profile" href="/me">Профиль ↗</Link>
      </header>
      {children}
    </div>
  );
}
