import { NextResponse, type NextRequest } from "next/server";
import { startVkLogin } from "@/server/auth-service";
import { authDeps } from "@/server/deps";
import { SESSION_COOKIE, VK_STATE_COOKIE, vkStateCookieOptions } from "@/server/http";

export async function GET(request: NextRequest) {
  const { redirectUrl, stateCookie } = await startVkLogin(authDeps(), request.cookies.get(SESSION_COOKIE)?.value ?? null);
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set(VK_STATE_COOKIE, stateCookie, vkStateCookieOptions());
  return response;
}
