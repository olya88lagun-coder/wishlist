import { SESSION_TTL_SECONDS } from "@wishlist/core";

export const SESSION_COOKIE = "wl_session";
export const VK_STATE_COOKIE = "wl_vk_oauth";
const VK_STATE_MAX_AGE_SECONDS = 600;

// SameSite=None нужен Telegram Web, где Mini App открывается в iframe
export function sessionCookieOptions() {
  return { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: SESSION_TTL_SECONDS } as const;
}

export function vkStateCookieOptions() {
  return { httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth/vk", maxAge: VK_STATE_MAX_AGE_SECONDS } as const;
}

export function isSameOrigin(request: Request, appUrl: string): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(appUrl).origin;
}
