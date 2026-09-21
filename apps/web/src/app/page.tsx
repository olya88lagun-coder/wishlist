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
          <p className="eyebrow landing__eyebrow">ПОДАРКИ</p>
          <h1 id="landing-title" className="display landing__title">Подарки, которые <i>правда хочется</i></h1>
          <p className="landing__lead">Соберите список желаний за минуту и поделитесь им. Друзья выберут подарок — и никто не подарит второй такой же.</p>
          <div className="landing__actions">
            <a className="button button--block landing__primary" href={primary!.href} target="_blank" rel="noopener noreferrer">
              <span className="button__mark" aria-hidden="true">↗</span>{primary!.label}<span aria-hidden="true">→</span>
            </a>
            <a className="button button--ghost button--block landing__secondary" href={secondary!.href}>
              <span className="button__mark button__mark--outline" aria-hidden="true">◎</span>{secondary!.label}<span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div className="premium-hero-art" aria-hidden="true">
          <img src="/hero-premium.png.png" alt="" />
        </div>
     </section>

      <ol className="landing__steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="landing__step">
            <span className="landing__number serif">{String(index + 1).padStart(2, "0")}</span>
            <div><h2 className="landing__step-title">{step.title}</h2><p className="muted" style={{ margin: 0 }}>{step.text}</p></div>
          </li>
        ))}
      </ol>
      <p className="muted">Бесплатно. Напомним гостям о празднике за 14, 7 и 2 дня.</p>
      <SiteFooter botUsername={env.TELEGRAM_BOT_USERNAME} />
    </main>
  );
}
