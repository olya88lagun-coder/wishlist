import { signSession } from "@wishlist/core";
import { upsertUserFromIdentity } from "@wishlist/db";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { isDevLoginEnabled } from "@/server/dev-login";
import { getEnv } from "@/server/env";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/http";

// Только для локальной разработки: Telegram-виджет не работает на localhost
export async function GET(request: NextRequest) {
  if (!isDevLoginEnabled(process.env)) return new NextResponse(null, { status: 404 });
  const name = request.nextUrl.searchParams.get("name") ?? "Разработчик";
  const user = await upsertUserFromIdentity(getDb(), { provider: "telegram", providerUserId: `dev-${name}`, displayName: name, avatarUrl: null });
  const response = NextResponse.redirect(new URL("/lists", getEnv().APP_URL), 303);
  response.cookies.set(SESSION_COOKIE, await signSession(user.id, getEnv().SESSION_SECRET), sessionCookieOptions());
  return response;
}
