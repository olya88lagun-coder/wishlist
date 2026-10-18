"use client";

import { useEffect, useRef, useState } from "react";

// Виджет Telegram вставляет iframe на место своего <script>, поэтому скрипт создаётся внутри контейнера
export function TelegramLoginButton({ botUsername, returnTo }: { botUsername: string; returnTo: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function prepare() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/telegram/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnTo }) });
      if (!response.ok) throw new Error("Не удалось начать вход. Попробуйте ещё раз.");
      const payload = await response.json();
      setAuthUrl(payload.authUrl);
    } catch {
      setError("Не удалось начать вход. Попробуйте ещё раз.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !authUrl) return;
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

  return <div style={{ margin: "24px 0", minHeight: 44 }}>
    {!authUrl && <button className="button" type="button" disabled={loading} onClick={prepare}>{loading ? "Открываем Telegram…" : "Войти через Telegram"}</button>}
    <div ref={containerRef} />
    {error && <p className="error" role="status">{error}</p>}
  </div>;
}
