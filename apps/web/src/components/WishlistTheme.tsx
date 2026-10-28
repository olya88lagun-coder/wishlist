import type { ReactNode } from "react";
import type { WishlistTheme as Theme } from "@wishlist/db";
import "./wishlist-theme.css";

export function WishlistTheme({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <div className="wishlist-theme" data-theme={theme}>{children}</div>;
}
