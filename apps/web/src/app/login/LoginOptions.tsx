"use client";

import { useEffect, useState } from "react";
import { FINDER_DRAFT_KEY, pendingFinderPath } from "@/app/gifts/finder-draft";
import { TelegramLoginButton } from "./TelegramLoginButton";

export function LoginOptions({ botUsername, returnTo }: { botUsername: string; returnTo: string | null }) {
  const [target, setTarget] = useState(returnTo);
  useEffect(() => {
    if (returnTo) { setTarget(returnTo); return; }
    try { setTarget(pendingFinderPath(sessionStorage.getItem(FINDER_DRAFT_KEY))); } catch { /* Обычный вход доступен без хранилища. */ }
  }, [returnTo]);
  return <>
    <TelegramLoginButton botUsername={botUsername} returnTo={target} />
    <a className="button" href={target ? `/api/auth/vk/start?returnTo=${encodeURIComponent(target)}` : "/api/auth/vk/start"}>Войти через VK ID</a>
  </>;
}
