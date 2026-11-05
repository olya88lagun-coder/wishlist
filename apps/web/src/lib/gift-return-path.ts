// Продолжение подборки допускает только страницы подарков, без внешних URL и служебных маршрутов.
export function giftReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 120 || raw.trim() !== raw) return null;
  return typeof raw === "string" && /^\/gifts(?:\/[a-z0-9-]+)?$/.test(raw) ? raw : null;
}

// После входа можно вернуться в подборку или в игру Тайного Санты (личные ссылки /santa/me/* — нет)
export function loginReturnPath(raw: unknown): string | null {
  if (giftReturnPath(raw)) return raw as string;
  return typeof raw === "string" && /^\/santa\/(?:new|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(raw) ? raw : null;
}
