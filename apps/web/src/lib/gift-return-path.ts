// Продолжение подборки допускает только страницы подарков, без внешних URL и служебных маршрутов.
export function giftReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 120 || raw.trim() !== raw) return null;
  return typeof raw === "string" && /^\/gifts(?:\/[a-z0-9-]+)?$/.test(raw) ? raw : null;
}

// Создание списка с возвратом в подборку: только точная форма /lists?returnTo=<закодированная подборка>
export function listCreationPath(giftPath: string): string {
  return `/lists?returnTo=${encodeURIComponent(giftPath)}`;
}

function isListCreationPath(raw: string): boolean {
  const prefix = "/lists?returnTo=";
  if (!raw.startsWith(prefix)) return false;
  let decoded: string;
  try { decoded = decodeURIComponent(raw.slice(prefix.length)); } catch { return false; }
  return giftReturnPath(decoded) !== null && listCreationPath(decoded) === raw;
}

// После входа можно вернуться в подборку, к созданию списка из подборки или в игру Тайного Санты (личные ссылки /santa/me/* — нет)
export function loginReturnPath(raw: unknown): string | null {
  if (giftReturnPath(raw)) return raw as string;
  if (typeof raw === "string" && isListCreationPath(raw)) return raw;
  return typeof raw === "string" && /^\/santa\/(?:new|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(raw) ? raw : null;
}
