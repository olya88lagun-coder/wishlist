import { signSession } from "@wishlist/core";
import { getUserWithIdentities, redeemSantaToken } from "@wishlist/db";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/http";

export const dynamic = "force-dynamic";

// Личная ссылка анонимного участника или одноразовая ссылка для возврата от организатора
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const redeemed = await redeemSantaToken(getDb(), token);
  const user = redeemed ? await getUserWithIdentities(getDb(), redeemed.userId) : null;
  if (!redeemed || !user) return new NextResponse("Ссылка недействительна", { status: 404 });
  const env = getEnv();
  const response = NextResponse.redirect(new URL(`/santa/${redeemed.gameId}`, env.APP_URL), 303);
  response.cookies.set(SESSION_COOKIE, await signSession(user.id, env.SESSION_SECRET, user.sessionVersion), sessionCookieOptions());
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
