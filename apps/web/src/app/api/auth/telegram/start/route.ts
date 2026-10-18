import { NextResponse, type NextRequest } from "next/server";
import { startTelegramLogin } from "@/server/auth-service";
import { authDeps } from "@/server/deps";
import { isSameOrigin, SESSION_COOKIE, TELEGRAM_STATE_COOKIE, telegramStateCookieOptions } from "@/server/http";

export async function POST(request: NextRequest) {
  const deps = authDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return new NextResponse(null, { status: 403 });
  let returnTo: unknown;
  try { returnTo = (await request.json()).returnTo; } catch { return new NextResponse(null, { status: 400 }); }
  const { authUrl, stateCookie } = await startTelegramLogin(deps, request.cookies.get(SESSION_COOKIE)?.value ?? null, typeof returnTo === "string" ? returnTo : null);
  const response = NextResponse.json({ authUrl });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(TELEGRAM_STATE_COOKIE, stateCookie, telegramStateCookieOptions());
  return response;
}
