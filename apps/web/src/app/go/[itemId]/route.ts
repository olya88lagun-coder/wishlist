import { getAffiliateUrl, getGoTarget, recordAffiliateClick } from "@wishlist/db";
import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { readViewer } from "@/server/viewer";
import { GO_COOKIE_MAX_AGE_SECONDS, goCookieName, isSafeRedirect } from "../go-cookie";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const target = await getGoTarget(getDb(), itemId);
  if (!target || !isSafeRedirect(target.sourceUrl)) return new NextResponse("Подарок не найден", { status: 404 });

  const { viewer } = await readViewer();
  const isOwner = viewer.userId === target.ownerId;
  // Владелец списка идёт в магазин по обычной ссылке: партнёрские программы запрещают клики и покупки по своим ссылкам
  const redirectUrl = isOwner ? target.sourceUrl : getAffiliateUrl(target.sourceUrl, target.store);
  const response = NextResponse.redirect(redirectUrl, 302);
  const cookie = goCookieName(target.itemId);
  // Клики владельца по своему списку и повторные клики за сутки не считаем
  if (isOwner || request.cookies.has(cookie)) return response;
  try {
    await recordAffiliateClick(getDb(), { itemId: target.itemId, store: target.store });
  } catch (error) {
    // Статистика не должна мешать гостю попасть в магазин
    console.error("go click not recorded", { itemId: target.itemId, error: String(error) });
  }
  response.cookies.set(cookie, "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/go", maxAge: GO_COOKIE_MAX_AGE_SECONDS });
  return response;
}
