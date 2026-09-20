import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { startLinks } from "@/components/start-links";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Вишлист — список желаний и подарков",
  description:
    "Создайте список желаний на день рождения, свадьбу, Новый год или просто так. Добавляйте товары из любых магазинов и отправляйте друзьям одну ссылку.",
  alternates: { canonical: "/" },
};

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Добавьте желание",
    text: "Вставьте ссылку на товар из Wildberries, Ozon, Золотого Яблока, Яндекс Маркета или любого магазина.",
  },
  {
    title: "Отправьте одну ссылку",
    text: "Друзья открывают ваш список в Telegram, VK или MAX и видят, что действительно хочется.",
  },
  {
    title: "Получите нужный подарок",
    text: "Гости бронируют подарки без регистрации — дубли исчезают, а сюрприз остаётся сюрпризом.",
  },
] as const;

export default async function Home() {
  const { user } = await readViewer();
  if (user) redirect("/lists");
  const env = getEnv();
  const [primary, secondary] = startLinks(env.TELEGRAM_BOT_USERNAME, false);

  return (
    <main className="page page--wide landing">
      <header className="landing__header">
        <p className="eyebrow">my wish list</p>
        <span className="landing__header-note">список желаний без лишнего</span>
      </header>

      <section className="landing__hero">
        <div className="landing__hero-copy">
          <h1 className="display">
            Подарки, которые <i>правда хочется</i>
          </h1>
          <p className="landing__lead">
            Соберите список желаний за минуту и поделитесь одной ссылкой.
            Друзья выберут подарок — и никто не подарит второй такой же.
          </p>

          <div className="landing__actions">
            <a className="button button--block" href={primary!.href} target="_blank" rel="noopener noreferrer">
              {primary!.label}
            </a>
            <a className="button button--ghost button--block" href={secondary!.href}>
              {secondary!.label}
            </a>
          </div>

          <p className="landing__note">Бесплатно · без лишней регистрации · работает с любыми магазинами</p>
        </div>

        <aside className="landing__how">
          <p className="eyebrow">Как это работает</p>
          <h2 className="landing__how-title">Три шага до подарка, который действительно нужен.</h2>
          <ol className="landing__steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="landing__step">
                <span className="landing__number serif">{index + 1}</span>
                <div>
                  <h3 className="landing__step-title">{step.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="landing__gift">
        <div>
          <p className="eyebrow">Нужен подарок?</p>
          <h2>Не знаете, что подарить?</h2>
          <p className="muted">
            Ответьте на несколько вопросов — AI поможет подобрать идеи по человеку,
            поводу, интересам и бюджету.
          </p>
        </div>
        <a className="button button--ghost" href="/gifts">
          Подобрать подарок
        </a>
      </section>

      <SiteFooter botUsername={env.TELEGRAM_BOT_USERNAME} />
    </main>
  );
}
