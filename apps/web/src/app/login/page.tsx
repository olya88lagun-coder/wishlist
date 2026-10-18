import { SiteFooter } from "@/components/SiteFooter";
import { getEnv } from "@/server/env";
import { LoginOptions } from "./LoginOptions";
import { giftReturnPath } from "@/lib/gift-return-path";

export const dynamic = "force-dynamic";

const ERROR_TEXT: Record<string, string> = {
  link_IDENTITY_TAKEN: "Этот аккаунт уже привязан к другому профилю.",
  link_PROVIDER_ALREADY_LINKED: "К профилю уже привязан другой аккаунт этого сервиса.",
  telegram_state_mismatch: "Вход устарел или начат в другой вкладке. Начните вход ещё раз.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; returnTo?: string }> }) {
  const { error, returnTo: rawReturnTo } = await searchParams;
  const returnTo = giftReturnPath(rawReturnTo);
  const env = getEnv();
  return (
    <main className="page">
      <h1 className="display">
        Ваш <i>вишлист</i>
      </h1>
      {error && <p className="error">{ERROR_TEXT[error] ?? "Не получилось войти. Попробуйте ещё раз."}</p>}
      <LoginOptions
        botUsername={env.TELEGRAM_BOT_USERNAME}
        returnTo={returnTo}
      />
      <SiteFooter botUsername={env.TELEGRAM_BOT_USERNAME} />
    </main>
  );
}
