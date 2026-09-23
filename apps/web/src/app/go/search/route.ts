import { getAffiliateUrl, recordStoreSearchClick } from "@wishlist/db";
import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { GO_COOKIE_MAX_AGE_SECONDS, isSafeRedirect, searchCookieName } from "../go-cookie";
import { isSearchStore, storeSearchUrl } from "../store-search";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 160;

export async function GET(request: NextRequest) {
  const store = request.nextUrl.searchParams.get("store") ?? "";
  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, MAX_QUERY_LENGTH);
  const source = (request.nextUrl.searchParams.get("from") ?? "unknown").slice(0, 60);

  if (!isSearchStore(store)) return new NextResponse("Неизвестный магазин", { status: 400 });

  const searchUrl = storeSearchUrl(store, query);
  if (!searchUrl) return new NextResponse("Пустой запрос", { status: 400 });

  // Партнёрский шаблон тот же, что и для подарков из списка; без него ведём прямо в магазин
  const redirectUrl = getAffiliateUrl(searchUrl, store);
  if (!isSafeRedirect(redirectUrl)) return new NextResponse("Некорректный адрес", { status: 400 });

  const response = NextResponse.redirect(redirectUrl, 302);
  const cookie = searchCookieName(store, query);
  if (request.cookies.has(cookie)) return response;

  try {
    await recordStoreSearchClick(getDb(), { store, source, query });
  } catch (error) {
    // Статистика не должна мешать человеку попасть в магазин
    console.error("store search click not recorded", { store, source, error: String(error) });
  }
  response.cookies.set(cookie, "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/go", maxAge: GO_COOKIE_MAX_AGE_SECONDS });
  return response;
}
