"use client";

import { useState } from "react";
import type { WishlistSummary } from "@wishlist/db";
import { addGiftToWishlist } from "./actions";
import { trackEvent } from "@/lib/analytics";
import { listCreationPath } from "@/lib/gift-return-path";

type Idea = { name: string; why: string; query: string };

// Сохранение готовой идеи из подборки в вишлист: гость сначала входит и создаёт список, затем возвращается в подборку
export function IdeaWishlistButton({ idea, wishlists, isAuthenticated, returnPath }: { idea: Idea; wishlists: WishlistSummary[]; isAuthenticated: boolean; returnPath: string }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  if (added) return <span className="button button--ghost button--small" role="status">✓ В вишлисте</span>;

  if (wishlists.length === 0) {
    const create = listCreationPath(returnPath);
    const href = isAuthenticated ? create : `/login?returnTo=${encodeURIComponent(create)}`;
    return <a className="button button--ghost button--small" href={href}>В вишлист</a>;
  }

  async function add(wishlistId: string) {
    setAdding(true);
    setError("");
    try {
      const response = await addGiftToWishlist({ wishlistId, title: idea.name, productUrl: null, note: `${idea.why} Поиск: ${idea.query}` });
      if (!response.ok) { setError(response.message); return; }
      setAdded(true);
      trackEvent("wishlist_item_added", { source: "collection" });
    } catch {
      setError("Не удалось добавить подарок. Проверьте соединение и попробуйте ещё раз.");
    } finally { setAdding(false); }
  }

  return (
    <>
      {wishlists.length === 1
        ? <button className="button button--ghost button--small" type="button" disabled={adding} onClick={() => add(wishlists[0]!.id)}>В вишлист</button>
        : <button className="button button--ghost button--small" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>В вишлист</button>}
      {open && wishlists.length > 1 && (
        <span role="group" aria-label={`Выберите вишлист для «${idea.name}»`}>
          {wishlists.map((wishlist) => (
            <button key={wishlist.id} className="button button--ghost button--small" type="button" disabled={adding} onClick={() => add(wishlist.id)}>{wishlist.title}</button>
          ))}
        </span>
      )}
      {error && <span className="error" role="status">{error}</span>}
    </>
  );
}
