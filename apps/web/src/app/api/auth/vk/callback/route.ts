import { NextResponse, type NextRequest } from "next/server";
import { finishVkLogin } from "@/server/auth-service";
import { authDeps } from "@/server/deps";
import { SESSION_COOKIE, sessionCookieOptions, VK_STATE_COOKIE, vkStateCookieOptions } from "@/server/http";

export async function GET(request: NextRequest) {
  const deps = authDeps();
  const q = request.nextUrl.searchParams;
  const result = await finishVkLogin(deps, {
    code: q.get("code"),
    deviceId: q.get("device_id"),
    state: q.get("state"),
    stateCookie: request.cookies.get(VK_STATE_COOKIE)?.value ?? null,
    currentSessionToken: request.cookies.get(SESSION_COOKIE)?.value ?? null,
  });
  const target = result.ok ? "/me" : `/login?error=${result.error}`;
  const response = NextResponse.redirect(new URL(target, deps.env.APP_URL), 303);
  response.cookies.set(VK_STATE_COOKIE, "", { ...vkStateCookieOptions(), maxAge: 0 });
  if (result.ok) response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  else console.warn("vk login failed", result.error);
  return response;
}
