import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { EditorialMenu } from "@/components/EditorialMenu";
import { startLinks } from "@/components/start-links";
import { ARTICLES } from "@/content/articles";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";
import "./home.css";

const HOME_DESCRIPTION =
  "Создайте вишлист на день рождения, свадьбу или Новый год. Добавляйте товары из Wildberries, Ozon и любых магазинов, делитесь одной ссылкой — друзья выберут подарок без повторов.";

// Коды подтверждения Яндекс Вебмастера и Search Console читаются при запросе: при сборке образа .env ещё нет
export function generateMetadata(): Metadata {
  const yandex = process.env.YANDEX_VERIFICATION;
  const google = process.env.GOOGLE_SITE_VERIFICATION;
  return {
    title: { absolute: "Вишлист онлайн — список желаний и подарков | MyWishList" },
    description: HOME_DESCRIPTION,
    alternates: { canonical: "/" },
    verification: {
      ...(google ? { google } : {}),
      ...(yandex ? { yandex } : {}),
    },
  };
}

export const dynamic = "force-dynamic";

function homeJsonLd(baseUrl: string) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "MyWishList",
      alternateName: "Мой вишлист",
      url: baseUrl,
      inLanguage: "ru-RU",
      description: HOME_DESCRIPTION,
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "MyWishList",
      url: baseUrl,
      logo: `${baseUrl}/apple-icon.png`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "MyWishList",
      url: baseUrl,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web, Telegram",
      offers: { "@type": "Offer", price: "0", priceCurrency: "RUB" },
    },
  ];
}

const STEPS = [
  {
    title: "Добавьте желание",
    text: "Вставьте ссылку на товар из Wildberries, Ozon, Золотого Яблока, Яндекс Маркета или любого магазина — название, фото и цена подтянутся сами.",
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

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="3.5" y="8.5" width="17" height="4" rx="0.5" />
      <path d="M5 12.5v8h14v-8M12 8.5v12" />
      <path d="M12 8.5c-1.5-3.5-5.5-4-5.5-1.5 0 1.5 2.5 1.5 5.5 1.5zm0 0c1.5-3.5 5.5-4 5.5-1.5 0 1.5-2.5 1.5-5.5 1.5z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M21.4 4.2 2.9 11.3c-1 .4-1 1.6.1 1.9l4.6 1.4 1.8 5.5c.2.7 1.1.9 1.6.4l2.6-2.4 4.6 3.4c.7.5 1.6.1 1.8-.7l3.1-14.5c.2-1-.7-1.8-1.7-1.4zM9.3 14.1l8.4-6.3-6.6 7.4-.3 3.1z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg className="hero-button__arrow" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 12h15M14 7l5 5-5 5" />
    </svg>
  );
}

export default async function Home() {
  const { user } = await readViewer();
  if (user) redirect("/lists");
  const env = getEnv();
  const [telegram, site] = startLinks(env.TELEGRAM_BOT_USERNAME, false);
  const articles = ARTICLES.slice(0, 3);

  return (
    <div className="home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd(env.APP_URL.replace(/\/$/, ""))).replace(/</g, "\\u003c") }}
      />
      <header className="home-header">
        <Link className="home-brand" href="/" aria-label="MyWishList — на главную">
          <GiftIcon />
          <span>MyWishList</span>
        </Link>
        <nav className="home-nav" aria-label="Разделы сайта">
          <Link href="/" aria-current="page">Главная</Link>
          <EditorialMenu />
          <a href="#how">Как это работает</a>
          <a href="#about">О нас</a>
        </nav>
        <div className="home-header__actions">
          <Link className="home-login" href="/login">Войти</Link>
          <Link className="home-create" href="/login">Создать список</Link>
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <p className="hero__eyebrow">Подарки</p>
            <h1 id="hero-title" className="hero__title">
              Подарки, которые <em className="hero__accent">правда</em> <em>хочется</em>
            </h1>
            <p className="hero__lead">
              Соберите список желаний за минуту и поделитесь им. Друзья выберут подарок — и никто не подарит второй такой же.
            </p>
            <div className="hero__actions">
              <a className="hero-button hero-button--dark" href={telegram!.href} target="_blank" rel="noopener noreferrer">
                <TelegramIcon />
                <span>{telegram!.label}</span>
                <Arrow />
              </a>
              <Link className="hero-button hero-button--light" href={site!.href}>
                <GlobeIcon />
                <span>{site!.label}</span>
                <Arrow />
              </Link>
            </div>
          </div>
          <div className="hero__scene">
            <Image
              src="/landing/hero-scene.webp"
              alt="Подарочная коробка с золотым бантом и карточки желаний: наушники, парфюм, часы"
              width={946}
              height={1024}
              sizes="(max-width: 899px) 100vw, 55vw"
              preload
            />
          </div>
        </section>

        <section id="how" className="home-section home-how" aria-labelledby="how-title">
          <p className="home-section__eyebrow">Как это работает</p>
          <h2 id="how-title" className="home-section__title">Три шага до подарка, который действительно нужен</h2>
          <ol className="home-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="home-step">
                <span className="home-step__number">{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-section home-finder" aria-labelledby="finder-title">
          <div>
            <p className="home-section__eyebrow">Нужен подарок?</p>
            <h2 id="finder-title" className="home-section__title">Не знаете, что подарить?</h2>
            <p>Ответьте на несколько вопросов — AI подберёт идеи по человеку, поводу, интересам и бюджету.</p>
          </div>
          <Link className="hero-button hero-button--light home-finder__button" href="/gifts">
            <span>Подобрать подарок</span>
            <Arrow />
          </Link>
        </section>

        <section className="home-section" aria-labelledby="articles-title">
          <p className="home-section__eyebrow">Идеи и советы</p>
          <h2 id="articles-title" className="home-section__title">Как выбрать подарок без случайных покупок</h2>
          <ul className="home-articles">
            {articles.map((article) => (
              <li key={article.slug}>
                <Link href={`/articles/${article.slug}`}>
                  <h3>{article.title}</h3>
                  <p>{article.description}</p>
                </Link>
              </li>
            ))}
          </ul>
          <Link className="home-more" href="/articles">Все статьи →</Link>
        </section>

        <section id="about" className="home-section home-about" aria-labelledby="about-title">
          <p className="home-section__eyebrow">О нас</p>
          <h2 id="about-title" className="home-section__title">Вишлист без лишнего</h2>
          <p>
            MyWishList — бесплатный сервис для списков желаний. Он работает на сайте и в Telegram: добавляйте подарки
            из любых магазинов, отмечайте, чего хочется больше всего, и отправляйте близким одну ссылку. Гости видят,
            что уже выбрано, и бронируют подарок без регистрации, а вы не узнаете, кто и что подарит, до самого праздника.
          </p>
        </section>
      </main>

      <div className="home-footer">
        <SiteFooter botUsername={env.TELEGRAM_BOT_USERNAME} />
      </div>
    </div>
  );
}
