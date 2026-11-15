"use client";

import { useState } from "react";
import type { WishlistSummary } from "@wishlist/db";
import { addGiftToWishlist } from "./actions";
import { announceGiftAdded } from "./SavedIdeasDock";
import { trackEvent } from "@/lib/analytics";
import { listCreationPath } from "@/lib/gift-return-path";

type Idea = { name: string; why: string; query: string };

// Сохранение готовой идеи из подборки в вишлист: гость сначала входит и создаёт список, затем возвращается в подборку
export function IdeaWishlistButton({ idea, wishlists, isAuthenticated, returnPath, source = "collection" }: { idea: Idea; wishlists: WishlistSummary[]; isAuthenticated: boolean; returnPath: string; source?: "collection" | "starter" }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  if (added) return <span className="gift-idea__saved" role="status">✓ В вишлисте</span>;

  if (wishlists.length === 0) {
    const create = listCreationPath(returnPath);
    const href = isAuthenticated ? create : `/login?returnTo=${encodeURIComponent(create)}`;
    return <a className="button gift-idea__save" href={href}>В вишлист</a>;
  }

  async function add(wishlistId: string) {
    setAdding(true);
    setError("");
    try {
      const response = await addGiftToWishlist({ wishlistId, title: idea.name, productUrl: null, note: `${idea.why} Поиск: ${idea.query}` });
      if (!response.ok) { setError(response.message); return; }
      setAdded(true);
      announceGiftAdded({ wishlistId, title: idea.name });
      trackEvent("wishlist_item_added", { source });
    } catch {
      setError("Не удалось добавить подарок. Проверьте соединение и попробуйте ещё раз.");
    } finally { setAdding(false); }
  }

  return (
    <>
      {wishlists.length === 1
        ? <button className="button gift-idea__save" type="button" disabled={adding} aria-busy={adding} onClick={() => add(wishlists[0]!.id)}>В вишлист</button>
        : <button className="button gift-idea__save" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>В вишлист</button>}
      {open && wishlists.length > 1 && (
        <div className="gift-idea__picker" role="group" aria-label={`Выберите вишлист для «${idea.name}»`} aria-busy={adding}>
          {wishlists.map((wishlist) => (
            <button key={wishlist.id} className="button button--ghost gift-idea__choice" type="button" disabled={adding} onClick={() => add(wishlist.id)}>{wishlist.title}</button>
          ))}
        </div>
      )}
      {error && <span className="error" role="status">{error}</span>}
    </>
  );
}
