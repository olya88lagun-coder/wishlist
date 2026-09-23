import type { AdminStats } from "@wishlist/db";

export const STATS_WINDOW_DAYS = 7;

const MICRO_RUB = 1_000_000;

export function percent(part: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((part / total) * 100)}%`;
}

// Цена одной подборки — доли копейки, поэтому для цены за единицу нужен третий знак
export function rub(microRub: number, digits = 2): string {
  return `${(microRub / MICRO_RUB).toFixed(digits).replace(".", ",")} ₽`;
}

export function statsText(stats: AdminStats): string {
  const visits = stats.storeVisits.byStore.map((row) => `${row.store} ${row.count}`).join(", ");
  const searches = stats.storeSearches.byStore.map((row) => `${row.store} ${row.count}`).join(", ");
  const sources = stats.storeSearches.topSources.map((row) => `${row.source} ${row.count}`).join(", ");
  const { ai } = stats;
  const costPerRequest = ai.requests > 0 ? rub(Math.round(ai.costMicroRub / ai.requests), 3) : "—";
  // Сколько AI стоит на один переход из подборщика и страниц подарков в магазин
  const costPerSearch = stats.storeSearches.new > 0 ? rub(Math.round(ai.costMicroRub / stats.storeSearches.new), 3) : "—";

  return [
    `📊 За ${STATS_WINDOW_DAYS} дней (всего)`,
    `Пользователи: +${stats.users.new} (${stats.users.total})`,
    `Списки: +${stats.wishlists.new} (${stats.wishlists.total}), с 3+ подарками: ${stats.wishlists.withThreeItems} (${percent(stats.wishlists.withThreeItems, stats.wishlists.total)}), с бронями: ${stats.wishlists.withReservations} (${percent(stats.wishlists.withReservations, stats.wishlists.total)})`,
    `Подарки: +${stats.items.new}`,
    `Брони: +${stats.reservations.new}`,
    `Переходы в магазин из списков: +${stats.storeVisits.new}${visits ? ` — ${visits}` : ""}`,
    `Переходы из идей и подборщика: +${stats.storeSearches.new}${searches ? ` — ${searches}` : ""}`,
    ...(sources ? [`Откуда: ${sources}`] : []),
    `AI: ${ai.requests} подборок, ${ai.attempts} попыток, неудачных ${ai.failedAttempts} (${percent(ai.failedAttempts, ai.attempts)})`,
    `AI расход: ${rub(ai.costMicroRub)}, на подборку ${costPerRequest}, на переход ${costPerSearch}`,
    `Хотят оформление: ${stats.themeInterest}`,
  ].join("\n");
}
