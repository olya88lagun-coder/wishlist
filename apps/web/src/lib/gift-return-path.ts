// Продолжение подборки допускает только страницы подарков, без внешних URL и служебных маршрутов.
export function giftReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 120 || raw.trim() !== raw) return null;
  return typeof raw === "string" && /^\/gifts(?:\/[a-z0-9-]+)?$/.test(raw) ? raw : null;
}
