import type { Metadata } from "next";
import { Playfair_Display, Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { CookieConsent } from "@/components/CookieConsent";
import { YandexMetrika } from "@/components/YandexMetrika";
import { TiltCards } from "@/components/TiltCards";

/* Source Sans 3: solid Cyrillic on Google Fonts (not Manrope / not Golos Text) */
const sourceSans = Source_Sans_3({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  variable: "--font-source-sans",
});
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
    <html lang="ru" className={`${sourceSans.variable} ${playfair.variable}`}>
      <body>{children}<CookieConsent /><YandexMetrika /><TiltCards /></body>
    </html>
  );
}
