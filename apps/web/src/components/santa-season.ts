import { todayInTimeZone } from "@wishlist/core";

// Баннеры «Тайного Санты» показываем с 1 ноября по 15 января по Москве; страница /santa доступна круглый год
export function isSantaSeason(now: Date = new Date()): boolean {
  const monthDay = todayInTimeZone(now).slice(5);
  return monthDay >= "11-01" || monthDay <= "01-15";
}

// Баннер письма от Деда Мороза: с 1 ноября по 31 декабря по Москве. После Нового года письмо уже не нужно
export function isDedMorozSeason(now: Date = new Date()): boolean {
  return todayInTimeZone(now).slice(5) >= "11-01";
}
