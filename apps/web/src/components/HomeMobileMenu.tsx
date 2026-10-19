"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export function HomeMobileMenu({ signedIn }: { signedIn: boolean }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !details.contains(event.target)) details.open = false;
    };
    const desktop = window.matchMedia("(min-width: 900px)");
    const closeOnDesktop = () => { if (desktop.matches) details.open = false; };
    document.addEventListener("pointerdown", closeOutside);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, []);

  return (
    <details
      ref={detailsRef}
      className="home-mobile-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape" && event.currentTarget.open) {
          event.preventDefault();
          event.currentTarget.open = false;
          summaryRef.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}
    >
      <summary ref={summaryRef}>Меню <span aria-hidden="true">☰</span></summary>
      <nav
        className="home-mobile-menu__panel"
        aria-label="Мобильные разделы сайта"
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a")) detailsRef.current!.open = false;
        }}
      >
        <Link href={signedIn ? "/lists" : "/login"}>{signedIn ? "Мои списки" : "Войти"}</Link>
        <Link href={signedIn ? "/me" : "/login"}>{signedIn ? "Профиль" : "Создать список"}</Link>
        <Link href="/gifts">Подобрать подарок</Link>
        <a href="#collections-title">Подборки подарков</a>
        <Link href="/articles">Статьи</Link>
        <a href="#how">Как это работает</a>
        <a href="#about">О нас</a>
      </nav>
    </details>
  );
}
