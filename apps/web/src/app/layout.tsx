import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { YandexMetrika } from "@/components/YandexMetrika";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope" });
const playfair = Playfair_Display({ subsets: ["latin", "cyrillic"], style: ["normal", "italic"], variable: "--font-playfair" });

// Абсолютные адреса для превью ссылок в мессенджерах; при сборке образа переменных окружения ещё нет
const PUBLIC_URL = process.env.APP_URL ?? "https://my-wish-list.online";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_URL),
  title: { default: "My Wish List — вишлист и список желаний", template: "%s | My Wish List" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${playfair.variable}`}>
      <body>{children}<YandexMetrika /></body>
    </html>
  );
}
