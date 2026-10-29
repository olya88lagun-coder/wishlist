import type { WishlistTheme } from "@wishlist/db";

// Выбор цвета в студии меняет только предпросмотр; на странице он сохраняется кнопкой «Применить».
export function isUnsavedSelection(selected: WishlistTheme, saved: WishlistTheme, purchased: boolean): boolean {
  return purchased && selected !== saved;
}
