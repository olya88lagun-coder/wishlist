"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FINDER_DRAFT_KEY, pendingFinderPath } from "@/app/gifts/finder-draft";
import { TelegramLoginButton } from "./TelegramLoginButton";

export function LoginOptions({ botUsername, returnTo }: { botUsername: string; returnTo: string | null }) {
  const [target, setTarget] = useState(returnTo);
  useEffect(() => {
    if (returnTo) { setTarget(returnTo); return; }
    try { setTarget(pendingFinderPath(sessionStorage.getItem(FINDER_DRAFT_KEY))); } catch { /* Обычный вход доступен без хранилища. */ }
  }, [returnTo]);
  return <>
    <p className="login-intro">
      {target
        ? "После входа вы вернётесь к подборке. Там можно сохранить идею в свой список желаний."
        : "Выберите Telegram или VK. После входа вы сможете создать список желаний и поделиться им с близкими."}
    </p>
    {target && <Link className="login-back" href={`${target}#gift-finder`}>← Вернуться к подборке</Link>}
    <TelegramLoginButton botUsername={botUsername} returnTo={target} />
    <a className="button" href={target ? `/api/auth/vk/start?returnTo=${encodeURIComponent(target)}` : "/api/auth/vk/start"}>Войти через VK ID</a>
  </>;
}
