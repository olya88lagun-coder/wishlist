"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function HomeStickyCreate({ href }: { href: string }) {
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-title")?.closest("section");
    if (!hero || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setPastHero(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <Link className="home-sticky-create" href={href} hidden={!pastHero}>
      Создать список
    </Link>
  );
}
