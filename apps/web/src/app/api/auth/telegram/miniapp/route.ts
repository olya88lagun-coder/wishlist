import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loginWithTelegramInitData } from "@/server/auth-service";
import { authDeps } from "@/server/deps";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/http";

const bodySchema = z.object({ initData: z.string().min(1).max(4096) });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const result = await loginWithTelegramInitData(authDeps(), parsed.data.initData);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  return response;
}
