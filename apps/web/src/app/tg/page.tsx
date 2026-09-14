import { TelegramAutoLogin } from "./TelegramAutoLogin";

export default function TelegramEntryPage() {
  return (
    <main className="page">
      <h1 className="display">
        Открываем <i>вишлист</i>…
      </h1>
      <TelegramAutoLogin />
    </main>
  );
}
