"use client";

import { useEffect, useRef } from "react";

// Виджет Telegram вставляет iframe на место своего <script>, поэтому скрипт создаётся внутри контейнера
export function TelegramLoginButton({ botUsername, authUrl }: { botUsername: string; authUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.dataset.telegramLogin = botUsername;
    script.dataset.size = "large";
    script.dataset.radius = "20";
    script.dataset.authUrl = authUrl;
    script.dataset.requestAccess = "write";
    container.replaceChildren(script);
    return () => container.replaceChildren();
  }, [botUsername, authUrl]);

  return <div ref={containerRef} style={{ margin: "24px 0", minHeight: 40 }} />;
}
