import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { startLinks } from "@/components/start-links";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";

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
      <section className="landing__hero" aria-labelledby="landing-title">
        <div className="landing__hero-copy">
          <p className="eyebrow">вишлист</p>
          <h1 id="landing-title" className="display">
            Подарки, которые <i>правда хочется</i>
          </h1>
          <p className="landing__lead">
            Соберите список желаний за минуту и поделитесь им. Друзья выберут подарок — и никто не подарит второй такой же.
          </p>
        </div>
        <div className="wish-orbit" aria-hidden="true">
          <div className="wish-orbit__glow" />
          <div className="wish-card wish-card--headphones">
            <span className="wish-card__icon">🎧</span>
            <span className="wish-card__name">Наушники</span>
            <span className="wish-card__price">18 990 ₽</span>
          </div>
          <div className="wish-card wish-card--perfume">
            <span className="wish-card__icon">🌸</span>
            <span className="wish-card__name">Парфюм</span>
            <span className="wish-card__price">7 490 ₽</span>
          </div>
          <div className="wish-card wish-card--watch">
            <span className="wish-card__icon">⌚</span>
            <span className="wish-card__name">Часы</span>
            <span className="wish-card__price">24 900 ₽</span>
          </div>
          <div className="wish-orbit__gift">🎁</div>
        </div>
      </section>
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
