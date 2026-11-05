import { todayInTimeZone } from "@wishlist/core";

// Баннеры «Тайного Санты» показываем с 1 ноября по 15 января по Москве; страница /santa доступна круглый год
export function isSantaSeason(now: Date = new Date()): boolean {
  const monthDay = todayInTimeZone(now).slice(5);
  return monthDay >= "11-01" || monthDay <= "01-15";
}
