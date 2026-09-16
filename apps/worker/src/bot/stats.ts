import type { AdminStats } from "@wishlist/db";

export const STATS_WINDOW_DAYS = 7;

export function percent(part: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((part / total) * 100)}%`;
}

export function statsText(stats: AdminStats): string {
  const visits = stats.storeVisits.byStore.map((row) => `${row.store} ${row.count}`).join(", ");
  return [
    `📊 За ${STATS_WINDOW_DAYS} дней (всего)`,
    `Пользователи: +${stats.users.new} (${stats.users.total})`,
    `Списки: +${stats.wishlists.new} (${stats.wishlists.total}), с 3+ подарками: ${stats.wishlists.withThreeItems} (${percent(stats.wishlists.withThreeItems, stats.wishlists.total)}), с бронями: ${stats.wishlists.withReservations} (${percent(stats.wishlists.withReservations, stats.wishlists.total)})`,
    `Подарки: +${stats.items.new}`,
    `Брони: +${stats.reservations.new}`,
    `Переходы в магазин: +${stats.storeVisits.new}${visits ? ` — ${visits}` : ""}`,
    `Хотят оформление: ${stats.themeInterest}`,
  ].join("\n");
}
