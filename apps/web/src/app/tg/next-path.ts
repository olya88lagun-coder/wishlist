export const DEFAULT_NEXT_PATH = "/lists";

// Только относительный путь внутри сайта: "//host" и "/\host" браузер понимает как другой домен
export function safeNextPath(raw: string | null): string {
  if (!raw || !/^\/[A-Za-z0-9/_-]*$/.test(raw) || raw.startsWith("//")) return DEFAULT_NEXT_PATH;
  return raw;
}
