import { getAffiliateUrl, recordStoreSearchClick } from "@wishlist/db";
import { type NextRequest, NextResponse } from "next/server";
import { brandOfferById } from "@/content/brand-offers";
import { getDb } from "@/server/db";
import { GO_COOKIE_MAX_AGE_SECONDS, searchCookieName } from "../go-cookie";

export const dynamic = "force-dynamic";

// Переход по карточке магазина бренда. Адрес берём только из списка карточек в коде, поэтому увести на чужой сайт нельзя.
export async function GET(request: NextRequest) {
  const offer = brandOfferById(request.nextUrl.searchParams.get("offer") ?? "");
  if (!offer) return new NextResponse("Предложение не найдено", { status: 404 });
  const source = (request.nextUrl.searchParams.get("from") ?? "unknown").slice(0, 60);

  const response = NextResponse.redirect(getAffiliateUrl(offer.target, offer.brand), 302);
  const cookie = searchCookieName(offer.brand, offer.id);
  if (request.cookies.has(cookie)) return response;

  try {
    await recordStoreSearchClick(getDb(), { store: offer.brand, source, query: offer.id });
  } catch (error) {
    // Статистика не должна мешать человеку попасть в магазин
    console.error("brand click not recorded", { offer: offer.id, error: String(error) });
  }
  response.cookies.set(cookie, "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/go", maxAge: GO_COOKIE_MAX_AGE_SECONDS });
  return response;
}
