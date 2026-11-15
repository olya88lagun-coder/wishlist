"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function HomeStickyCreate({ href }: { href: string }) {
  const [pastHero, setPastHero] = useState(false);
  const [atFinal, setAtFinal] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-title")?.closest("section");
    if (!hero || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setPastHero(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    });
    observer.observe(hero);

    // Внизу страницы уже есть те же кнопки создания: липкую кнопку прячем
    const final = document.getElementById("final-title")?.closest("section");
    const finalObserver = final ? new IntersectionObserver(([entry]) => entry && setAtFinal(entry.isIntersecting)) : null;
    if (final) finalObserver?.observe(final);
    return () => {
      observer.disconnect();
      finalObserver?.disconnect();
    };
  }, []);

  return (
    <Link className="home-sticky-create" href={href} hidden={!pastHero || atFinal}>
      Создать список
    </Link>
  );
}
