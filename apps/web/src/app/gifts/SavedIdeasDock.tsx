"use client";

import { useEffect, useState } from "react";

export const GIFT_ADDED_EVENT = "gift-added-to-wishlist";
type Detail = { wishlistId: string; title: string };

// Сообщает плашке, что подарок сохранён. Вызывать после успешного addGiftToWishlist
export function announceGiftAdded(detail: Detail) {
  window.dispatchEvent(new CustomEvent<Detail>(GIFT_ADDED_EVENT, { detail }));
}

// Плавающая плашка «В вашем списке: N» — человек видит, что собирает список, и может открыть его
export function SavedIdeasDock() {
  const [count, setCount] = useState(0);
  const [wishlistId, setWishlistId] = useState<string | null>(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    const onAdded = (event: Event) => {
      const { wishlistId: id } = (event as CustomEvent<Detail>).detail;
      setCount((current) => current + 1);
      setWishlistId(id);
      setBump((current) => current + 1);
    };
    window.addEventListener(GIFT_ADDED_EVENT, onAdded);
    return () => window.removeEventListener(GIFT_ADDED_EVENT, onAdded);
  }, []);

  if (count === 0 || !wishlistId) return null;
  return (
    <a key={bump} className="saved-dock" href={`/lists/${wishlistId}`} aria-live="polite">
      <span className="saved-dock__icon" aria-hidden="true">🎁</span>
      <span>В вашем списке: <strong>{count}</strong></span>
      <span className="saved-dock__open">Открыть →</span>
    </a>
  );
}
