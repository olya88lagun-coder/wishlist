"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { safeNextPath } from "./next-path";

type TelegramWindow = Window & { Telegram?: { WebApp?: { initData: string; ready: () => void } } };

const TELEGRAM_SDK_URL = "https://telegram.org/js/telegram-web-app.js";

// next/script c beforeInteractive в App Router разрешён только в корневом layout, поэтому SDK грузится здесь
function loadTelegramSdk(): Promise<void> {
  if ((window as TelegramWindow).Telegram?.WebApp) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TELEGRAM_SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("telegram sdk failed to load"));
    document.head.appendChild(script);
  });
}

export function TelegramAutoLogin() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadTelegramSdk()
      .then(async () => {
        const webApp = (window as TelegramWindow).Telegram?.WebApp;
        if (!webApp?.initData) throw new Error("no init data");
        webApp.ready();
        const res = await fetch("/api/auth/telegram/miniapp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData: webApp.initData }),
        });
        if (!res.ok) throw new Error(`login failed: ${res.status}`);
        router.replace(safeNextPath(new URLSearchParams(window.location.search).get("next")));
      })
      .catch((error: unknown) => {
        console.warn("telegram mini app login failed", error);
        setFailed(true);
      });
  }, [router]);

  if (!failed) return null;
  return <p className="error">Откройте эту страницу из Telegram-бота.</p>;
}
