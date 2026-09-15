"use client";

import { useEffect, useState } from "react";

const COPIED_RESET_MS = 2000;

export function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  // navigator есть только в браузере: проверяем после гидратации, иначе разметка сервера и клиента разойдётся
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => setCanNativeShare(typeof navigator.share === "function"), []);
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      window.prompt("Скопируйте ссылку", url);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // пользователь закрыл системное окно — ничего не делаем
    }
  }

  return (
    <section className="panel stack" aria-label="Поделиться списком">
      <p className="muted" style={{ margin: 0, overflowWrap: "anywhere" }}>{url}</p>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button type="button" className="button button--small" onClick={copy}>{copied ? "Скопировано" : "Скопировать ссылку"}</button>
        <a className="button button--ghost button--small" href={telegramUrl} target="_blank" rel="noopener noreferrer">Telegram</a>
        {canNativeShare && <button type="button" className="button button--ghost button--small" onClick={nativeShare}>Ещё…</button>}
      </div>
    </section>
  );
}
