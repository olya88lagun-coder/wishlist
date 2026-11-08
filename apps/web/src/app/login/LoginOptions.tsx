"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FINDER_DRAFT_KEY, pendingFinderPath } from "@/app/gifts/finder-draft";
import { DED_MOROZ_LIST_PATH } from "@/lib/gift-return-path";
import { TelegramLoginButton } from "./TelegramLoginButton";

export function LoginOptions({ botUsername, returnTo }: { botUsername: string; returnTo: string | null }) {
  const [target, setTarget] = useState(returnTo);
  useEffect(() => {
    if (returnTo) { setTarget(returnTo); return; }
    try { setTarget(pendingFinderPath(sessionStorage.getItem(FINDER_DRAFT_KEY))); } catch { /* Обычный вход доступен без хранилища. */ }
  }, [returnTo]);
  const letter = target === DED_MOROZ_LIST_PATH;
  return <>
    <p className="login-intro">
      {letter
        ? "После входа откроется новое письмо Деду Морозу: желания ребёнка сохранятся списком, и им можно будет поделиться с родными."
        : target
        ? "После входа вы вернётесь к подборке. Там можно сохранить идею в свой список желаний."
        : "Выберите Telegram или VK. После входа вы сможете создать список желаний и поделиться им с близкими."}
    </p>
    {letter
      ? <Link className="login-back" href="/wishlist/pismo-dedu-morozu">← Вернуться к письму Деду Морозу</Link>
      : target && <Link className="login-back" href={`${target}#gift-finder`}>← Вернуться к подборке</Link>}
    <TelegramLoginButton botUsername={botUsername} returnTo={target} />
    <a className="button" href={target ? `/api/auth/vk/start?returnTo=${encodeURIComponent(target)}` : "/api/auth/vk/start"}>Войти через VK ID</a>
  </>;
}
