import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { startLinks } from "@/components/start-links";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";

export const metadata: Metadata = { title: "Вишлист — список желаний и подарков", description: "Создайте список желаний на день рождения, свадьбу, Новый год или просто так. Добавляйте товары из любых магазинов и отправляйте друзьям одну ссылку.", alternates: { canonical: "/" } };

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Вставьте ссылку", text: "Из Wildberries, Ozon, Золотого Яблока, Яндекс Маркета или любого магазина — фото и цена подтянутся сами." },
  { title: "Отправьте друзьям", text: "Ссылка на список красиво разворачивается в Telegram, VK и MAX." },
  { title: "Получайте то, что хотели", text: "Друзья бронируют подарки без регистрации. Вы не узнаете, кто что дарит, а подарки не повторятся." },
] as const;

export default async function Home() {
  const { user } = await readViewer();
  if (user) redirect("/lists");
  const env = getEnv();
  const [primary, secondary] = startLinks(env.TELEGRAM_BOT_USERNAME, false);

  return (
    <main className="page landing">
      <p className="eyebrow">my wish list</p>
      <h1 className="display">
        Подарки, которые <i>правда хочется</i>
      </h1>
      <p className="landing__lead">
        Соберите список желаний за минуту и поделитесь им. Друзья выберут подарок — и никто не подарит второй такой же.
      </p>
      <div className="gifts-page__seo" style={{ marginTop: 24 }}>
        <p className="eyebrow">Нужен подарок?</p>
        <h2>Не знаете, что подарить?</h2>
        <p className="muted">Ответьте на несколько вопросов — AI поможет подобрать идеи по человеку, поводу, интересам и бюджету.</p>
        <a className="button button--ghost button--small" href="/gifts">Подобрать подарок</a>
      </div>
      <div className="stack">
        <a className="button button--block" href={primary!.href} target="_blank" rel="noopener noreferrer">
          {primary!.label}
        </a>
        <a className="button button--ghost button--block" href={secondary!.href}>
          {secondary!.label}
        </a>
      </div>
      <ol className="landing__steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="landing__step">
            <span className="landing__number serif">{index + 1}</span>
            <div>
              <h2 className="landing__step-title">{step.title}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="muted">Бесплатно. Напомним гостям о празднике за 14, 7 и 2 дня.</p>
      <SiteFooter botUsername={env.TELEGRAM_BOT_USERNAME} />
    </main>
  );
}
