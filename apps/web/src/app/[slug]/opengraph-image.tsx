import { getPublicWishlist } from "@wishlist/db";
import { ImageResponse } from "next/og";
import { getDb } from "@/server/db";
import { ogModel } from "./og-model";
import { loadOgFonts, OG_SIZE, ogImageElement } from "./og-render";

export const alt = "Вишлист";
export const size = OG_SIZE;
export const contentType = "image/png";
// Картинку тянут краулеры мессенджеров: десяти минут кэша достаточно, чтобы не рисовать её на каждый запрос
export const revalidate = 600;

const FALLBACK = { eyebrow: "вишлист", title: "Список подарков", items: "", countdown: null };

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Гостевой просмотр: зритель анонимный, брони и имена в картинку не попадают
  const view = await getPublicWishlist(getDb(), slug, { userId: null, guestToken: null });
  const model = view ? ogModel(view, new Date()) : FALLBACK;
  return new ImageResponse(ogImageElement(model), { ...size, fonts: await loadOgFonts() });
}
