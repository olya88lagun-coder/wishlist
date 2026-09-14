import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth-service";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { SESSION_COOKIE } from "@/server/http";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const cookieStore = await cookies();
  const user = await getCurrentUser({ db: getDb(), env: getEnv() }, cookieStore.get(SESSION_COOKIE)?.value ?? null);
  if (!user) redirect("/login");
  const hasVk = user.providers.includes("vk");
  const hasTelegram = user.providers.includes("telegram");
  return (
    <main className="page">
      <h1 className="display">
        Привет, <i>{user.displayName}</i>
      </h1>
      <p className="muted">Вход через: {user.providers.join(", ")}</p>
      {!hasVk && (
        <a className="button" href="/api/auth/vk/start" style={{ marginBottom: 12 }}>
          Привязать VK ID
        </a>
      )}
      {!hasTelegram && <p className="muted">Чтобы привязать Telegram, войдите через Telegram на странице входа, не выходя из профиля.</p>}
      <form action="/api/auth/logout" method="post">
        <button className="button" type="submit">
          Выйти
        </button>
      </form>
    </main>
  );
}
