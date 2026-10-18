import { NextResponse, type NextRequest } from "next/server";
import { loginWithTelegramWidget } from "@/server/auth-service";
import { authDeps } from "@/server/deps";
import { SESSION_COOKIE, sessionCookieOptions, TELEGRAM_STATE_COOKIE, telegramStateCookieOptions } from "@/server/http";

export async function GET(request: NextRequest) {
  const deps = authDeps();
  const result = await loginWithTelegramWidget(deps, request.nextUrl.searchParams, request.cookies.get(SESSION_COOKIE)?.value ?? null, request.cookies.get(TELEGRAM_STATE_COOKIE)?.value ?? null);
  const target = result.ok ? result.returnTo ?? "/lists" : `/login?error=${result.error}`;
  const response = NextResponse.redirect(new URL(target, deps.env.APP_URL), 303);
  response.cookies.set(TELEGRAM_STATE_COOKIE, "", { ...telegramStateCookieOptions(), maxAge: 0 });
  if (result.ok) response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  return response;
}
