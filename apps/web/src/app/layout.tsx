import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { YandexMetrika } from "@/components/YandexMetrika";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope" });
const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

const PUBLIC_URL = process.env.APP_URL ?? "https://my-wish-list.online";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_URL),
  title: {
    default: "MyWishList — список желаний без повторяющихся подарков",
    template: "%s | MyWishList",
  },
  description:
    "Создайте вишлист, добавьте подарки из любимых магазинов и поделитесь ссылкой. Друзья смогут забронировать подарок, сохранив сюрприз.",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "MyWishList",
    title: "MyWishList — подарки, которые правда хочется",
    description:
      "Соберите список желаний за минуту и поделитесь им без повторяющихся подарков.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyWishList — подарки, которые правда хочется",
    description: "Удобные списки желаний для вас и ваших близких.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${playfair.variable}`}>
      <body>{children}<YandexMetrika /></body>
    </html>
  );
}
