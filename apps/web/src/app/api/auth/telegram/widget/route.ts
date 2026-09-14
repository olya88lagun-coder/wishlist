import { NextResponse, type NextRequest } from "next/server";
import { loginWithTelegramWidget } from "@/server/auth-service";
import { authDeps } from "@/server/deps";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/http";

export async function GET(request: NextRequest) {
  const deps = authDeps();
  const result = await loginWithTelegramWidget(deps, request.nextUrl.searchParams, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!result.ok) return NextResponse.redirect(new URL(`/login?error=${result.error}`, deps.env.APP_URL), 303);
  const response = NextResponse.redirect(new URL("/me", deps.env.APP_URL), 303);
  response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  return response;
}
