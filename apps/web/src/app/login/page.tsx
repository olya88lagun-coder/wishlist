import { getEnv } from "@/server/env";
import { TelegramLoginButton } from "./TelegramLoginButton";

export const dynamic = "force-dynamic";

const ERROR_TEXT: Record<string, string> = {
  link_IDENTITY_TAKEN: "Этот аккаунт уже привязан к другому профилю.",
  link_PROVIDER_ALREADY_LINKED: "К профилю уже привязан другой аккаунт этого сервиса.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const env = getEnv();
  return (
    <main className="page">
      <h1 className="display">
        Ваш <i>вишлист</i>
      </h1>
      {error && <p className="error">{ERROR_TEXT[error] ?? "Не получилось войти. Попробуйте ещё раз."}</p>}
      <TelegramLoginButton
        botUsername={env.TELEGRAM_BOT_USERNAME}
        authUrl={new URL("/api/auth/telegram/widget", env.APP_URL).toString()}
      />
      <a className="button" href="/api/auth/vk/start">
        Войти через VK ID
      </a>
    </main>
  );
}
