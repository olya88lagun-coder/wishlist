import Link from "next/link";
import { requireUser } from "@/server/viewer";
import { SiteFooter } from "@/components/SiteFooter";
import { SurpriseModeForm } from "./SurpriseModeForm";

export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<string, string> = { telegram: "Telegram", vk: "VK ID" };

export default async function MePage() {
  const user = await requireUser();
  const hasVk = user.providers.includes("vk");
  const hasTelegram = user.providers.includes("telegram");
  return (
    <main className="page stack">
      <Link className="eyebrow" href="/lists">← Мои списки</Link>
      <h1 className="display" style={{ marginBottom: 0 }}>
        {user.displayName.split(" ")[0]}, <i>это вы</i>
      </h1>
      <p className="muted">Вход через: {user.providers.map((p) => PROVIDER_LABEL[p] ?? p).join(", ")}</p>
      {!hasVk && <a className="button button--ghost button--block" href="/api/auth/vk/start">Привязать VK ID</a>}
      {!hasTelegram && <p className="muted">Чтобы привязать Telegram, нажмите «Войти через Telegram» на странице входа, не выходя из профиля.</p>}
      <SurpriseModeForm enabled={user.surpriseMode} />
      <form action="/api/auth/logout" method="post">
        <button className="button button--ghost button--block" type="submit">Выйти</button>
      </form>
      <SiteFooter />
    </main>
  );
}
