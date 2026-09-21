import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { startLinks } from "@/components/start-links";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

const STEPS = [
  { number: "01", title: "Вставьте ссылку", text: "Из Wildberries, Ozon, Золотого Яблока, Яндекс Маркета или любого магазина — фото и цена подтянутся сами." },
  { number: "02", title: "Поделитесь списком", text: "Ссылка красиво открывается в Telegram, VK и MAX — без лишних регистраций для гостей." },
  { number: "03", title: "Получайте желанные подарки", text: "Друзья бронируют подарок, а дубли исключаются. Вы не узнаёте, кто что выбрал." },
] as const;

const ARTICLES = [
  "Как составить вишлист, который действительно помогает выбрать подарок",
  "Идеи подарков: как не получать одно и то же дважды",
  "Как красиво поделиться списком желаний с друзьями",
] as const;

export default async function Home() {
  const { user } = await readViewer();
  if (user) redirect("/lists");
  const env = getEnv();
  const [primary, secondary] = startLinks(env.TELEGRAM_BOT_USERNAME, false);

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <a className="landing-brand" href="/" aria-label="MyWishList — главная">
          <span className="landing-brand__mark" aria-hidden="true">✧</span>
          <span>MyWishList</span>
        </a>
        <nav className="landing-nav__links" aria-label="Основная навигация">
          <a className="is-active" href="#top">Главная</a>
          <a href="#articles">Статьи</a>
          <a href="#how-it-works">Как это работает</a>
        </nav>
        <div className="landing-nav__actions">
          <a className="landing-nav__login" href="/login">Вход</a>
          <a className="landing-nav__create" href="/lists">Создать список</a>
        </div>
      </header>

      <section id="top" className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__copy">
          <p className="landing-hero__eyebrow"><span /> ПОДАРКИ</p>
          <h1 id="landing-title">
            Подарки,<br />
            которые<br />
            <em>правда хочется</em>
          </h1>
          <p className="landing-hero__lead">
            Соберите список желаний за минуту и поделитесь им.
            Друзья выберут подарок — и никто не подарит второй такой же.
          </p>
          <div className="landing-hero__actions">
            <a className="landing-button landing-button--dark" href={primary!.href} target="_blank" rel="noopener noreferrer">
              <span className="landing-button__icon" aria-hidden="true">↗</span>
              <span>{primary!.label}</span>
              <span aria-hidden="true">→</span>
            </a>
            <a className="landing-button landing-button--light" href={secondary!.href}>
              <span className="landing-button__icon landing-button__icon--light" aria-hidden="true">◎</span>
              <span>{secondary!.label}</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div className="landing-hero__visual" aria-hidden="true">
          <img src="/hero-premium.png.png" alt="" />
        </div>
      </section>

      <section id="how-it-works" className="landing-steps" aria-labelledby="steps-title">
        <div className="landing-section-head">
          <p className="landing-hero__eyebrow"><span /> КАК ЭТО РАБОТАЕТ</p>
          <h2 id="steps-title">Просто. Красиво.<br /><em>По-настоящему удобно.</em></h2>
        </div>
        <div className="landing-steps__grid">
          {STEPS.map((step) => (
            <article key={step.number} className="landing-step-card">
              <span className="landing-step-card__number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="articles" className="landing-articles" aria-labelledby="articles-title">
        <div className="landing-section-head">
          <p className="landing-hero__eyebrow"><span /> СТАТЬИ</p>
          <h2 id="articles-title">Идеи подарков и<br /><em>вдохновение.</em></h2>
        </div>
        <div className="landing-articles__grid">
          {ARTICLES.map((title, index) => (
            <a key={title} className="landing-article-card" href="#top">
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <small>Читать →</small>
            </a>
          ))}
        </div>
      </section>

      <section className="landing-bottom-cta" aria-label="Создать список желаний">
        <p className="landing-hero__eyebrow"><span /> ВАШИ ЖЕЛАНИЯ</p>
        <h2>Пусть дарят<br /><em>то, что хочется.</em></h2>
        <a className="landing-button landing-button--dark" href="/lists">
          <span className="landing-button__icon" aria-hidden="true">↗</span>
          <span>Создать список</span>
          <span aria-hidden="true">→</span>
        </a>
      </section>

      <SiteFooter botUsername={env.TELEGRAM_BOT_USERNAME} />
    </main>
  );
}
