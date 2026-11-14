import type { Metadata } from "next";
import Link from "next/link";
import { OtherProjects } from "@/components/OtherProjects";
import { SiteFooter } from "@/components/SiteFooter";
import { EditorialMenu } from "@/components/EditorialMenu";
import { HomeMobileMenu } from "@/components/HomeMobileMenu";
import { HomeGiftCollections } from "@/components/HomeGiftCollections";
import { HomeWishlistPreview } from "@/components/HomeWishlistPreview";
import { SantaBanner } from "@/components/SantaBanner";
import { DedMorozBanner } from "@/components/DedMorozBanner";
import { ScrollEffects } from "@/components/ScrollEffects";
import { SeasonalSnow } from "@/components/SeasonalSnow";
import { TypewriterPlaceholder } from "@/components/TypewriterPlaceholder";
import { isSantaSeason } from "@/components/santa-season";
import { startLinks } from "@/components/start-links";
import { ARTICLES } from "@/content/articles";
import { HOME_FAQ } from "@/content/home-faq";
import { faqPageJsonLd } from "@/lib/structured-data";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";
import "./home.css";

// Почти весь поисковый трафик приходит по запросу «вишлист» (Вебмастер, ноябрь 2026), поэтому он первым словом
const HOME_TITLE = "Вишлист онлайн — создать список желаний бесплатно | MyWishList";
const HOME_DESCRIPTION =
  "Вишлист онлайн: создайте список желаний на сайте или в Telegram, добавьте подарки из любых магазинов и поделитесь одной ссылкой. Бронь без регистрации.";

// Коды подтверждения Яндекс Вебмастера и Search Console публичны (попадают в HTML),
// поэтому известные значения лежат в коде; переменные окружения могут их переопределить
const DEFAULT_YANDEX_VERIFICATION = "a4b37b24e60c31e9";
const DEFAULT_GOOGLE_SITE_VERIFICATION = "WoYcX61EDftCLKgkNKcej5GQCO9TZQuo2Lr0TEvcS_4";

export function generateMetadata(): Metadata {
  const yandex = process.env.YANDEX_VERIFICATION || DEFAULT_YANDEX_VERIFICATION;
  const google = process.env.GOOGLE_SITE_VERIFICATION || DEFAULT_GOOGLE_SITE_VERIFICATION;
  return {
    title: { absolute: HOME_TITLE },
    description: HOME_DESCRIPTION,
    alternates: { canonical: "/" },
    verification: {
      ...(google ? { google } : {}),
      ...(yandex ? { yandex } : {}),
      other: {
        "mitgo-verification": "4b6d5dae-47cc-4644-904d-7deb0cdc5f96",
        "takprodam-verification": "881f5ded-b70f-4912-a6f9-7034b4d687ed",
      },
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
      // Варианты, которыми сайт ищут в Google (Search Console, октябрь 2026): помогают узнать бренд в выдаче
      alternateName: ["Мой вишлист", "My Wish List", "Майвишлист", "Май вишлист", "my-wish-list.online"],
      url: baseUrl,
      inLanguage: "ru-RU",
      description: HOME_DESCRIPTION,
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "MyWishList",
      alternateName: "Мой вишлист",
      url: baseUrl,
      logo: `${baseUrl}/apple-icon.png`,
      sameAs: [`https://t.me/${process.env.TELEGRAM_BOT_USERNAME ?? "my_wish_list1_bot"}`],
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
    faqPageJsonLd(HOME_FAQ),
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

const TRUST_ITEMS = [
  { value: "1 ссылка", label: "для Telegram, VK, MAX и гостей" },
  { value: "0 дублей", label: "подарки бронируются без регистрации" },
  { value: "любой магазин", label: "Wildberries, Ozon, маркетплейсы и локальные бренды" },
] as const;

// Примеры для печатающегося плейсхолдера в поле AI-подбора
const FINDER_EXAMPLES = [
  "брат, 30 лет, любит походы",
  "мама, сад и чай, до 3 000 ₽",
  "коллега, кофе, Тайный Санта",
  "подруга, йога и книги",
] as const;

const OCCASIONS = [
  {
    title: "День рождения",
    text: "Соберите желания разного бюджета и отправьте близким один аккуратный ориентир.",
    href: "/wishlist/birthday",
  },
  {
    title: "Свадьба",
    text: "Гости видят свободные идеи, а пара не получает два одинаковых подарка.",
    href: "/gifts/wedding",
  },
  {
    title: "Новый год",
    text: "Подготовьте семейный список заранее и сохраните интригу до праздника.",
    href: "/wishlist/new-year",
  },
  {
    title: "Подарок маме",
    text: "Начните с интересов, привычек и маленьких ежедневных радостей.",
    href: "/gifts/for-mom",
  },
] as const;

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M5 12.5v8h14v-8M12 12.5v8" />
      <g className="home-gift__lid">
        <rect x="3.5" y="8.5" width="17" height="4" rx="0.5" />
        <path d="M12 8.5c-1.5-3.5-5.5-4-5.5-1.5 0 1.5 2.5 1.5 5.5 1.5zm0 0c1.5-3.5 5.5-4 5.5-1.5 0 1.5-2.5 1.5-5.5 1.5z" />
      </g>
      <g className="home-gift__sparks" stroke="#c39650" strokeLinecap="round">
        <path d="m3 6-2-2m11-1V0m8 6 2-2m0 6h2" />
      </g>
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
  const env = getEnv();
  const signedIn = Boolean(user);
  const start = startLinks(env.TELEGRAM_BOT_USERNAME, signedIn);
  const [telegram, site] = signedIn ? [null, null] : start;
  const listLink = signedIn ? start[0] : null;
  const articles = ARTICLES.slice(0, 3);
  const createActions = signedIn ? (
    <>
      <Link className="hero-button hero-button--dark" href={listLink!.href}>
        <GlobeIcon />
        <span>{listLink!.label}</span>
        <Arrow />
      </Link>
      <Link className="hero-button hero-button--light" href="/me">
        <GlobeIcon />
        <span>Профиль</span>
        <Arrow />
      </Link>
    </>
  ) : (
    <>
      <a className="hero-button hero-button--dark" href={telegram!.href} target="_blank" rel="noopener noreferrer">
        <TelegramIcon />
        <span>{telegram!.label}</span>
        <Arrow />
      </a>
      <Link className="hero-button hero-button--light" href={site!.href}>
        <span className="hero-button__site-icon"><GlobeIcon /><GiftIcon /></span>
        <span>{site!.label}</span>
        <Arrow />
      </Link>
    </>
  );

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
          {signedIn ? <Link className="home-login" href="/me">Профиль</Link> : <Link className="home-login" href="/login">Войти</Link>}
          <Link className="home-create" href={signedIn ? "/lists" : "/login"}>{signedIn ? "Мои списки" : "Создать список"}</Link>
          <HomeMobileMenu signedIn={signedIn} />
        </div>
      </header>

      <ScrollEffects reveal="main > .home-section, .home-step, .home-occasion" />
      <main>
        <section className="hero" aria-labelledby="hero-title">
          {isSantaSeason() && <SeasonalSnow />}
          <div className="hero__copy">
            <p className="hero__eyebrow">Вишлист</p>
            <h1 id="hero-title" className="hero__title">
              Список желаний онлайн: <em>подарки, которые</em> <em className="hero__accent">правда хочется</em>
            </h1>
            <p className="hero__lead">
              Создайте вишлист на сайте или в Telegram за минуту и отправьте друзьям одну ссылку. Они выберут подарок без регистрации, и никто не подарит второй такой же.
            </p>
            <div className="hero__actions">
              {createActions}
            </div>
            <p className="hero__finder-link">Не знаете, что подарить? <a href="#finder">Подобрать с AI →</a></p>
          </div>
          <HomeWishlistPreview />
        </section>

        <section className="home-trust" aria-label="Почему удобно использовать MyWishList">
          {TRUST_ITEMS.map((item) => (
            <div className="home-trust__item" key={item.value}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </section>

        <section id="finder" className="home-section home-finder" aria-labelledby="finder-title">
          <div>
            <p className="home-section__eyebrow">Нужен подарок?</p>
            <h2 id="finder-title" className="home-section__title">Не знаете, что подарить?</h2>
            <p>Ответьте на несколько вопросов — AI подберёт идеи по человеку, поводу, интересам и бюджету.</p>
          </div>
          <form className="home-finder__form" action="/gifts" method="get" aria-labelledby="finder-title">
            <label htmlFor="home-finder-interests">Кому вы выбираете подарок и что этот человек любит?</label>
            <div className="home-finder__row">
              <input
                id="home-finder-interests"
                className="home-finder__input"
                type="text"
                name="interests"
                maxLength={200}
                autoComplete="off"
                placeholder="Например: брат, походы, кофе"
              />
              <button className="home-finder__submit" type="submit">Подобрать с AI</button>
            </div>
          </form>
          <TypewriterPlaceholder targetId="home-finder-interests" examples={FINDER_EXAMPLES} />
        </section>

        <div className="home-section home-santa">
          <SantaBanner />
        </div>

        <div className="home-section">
          <DedMorozBanner />
        </div>

        <section className="home-section home-occasions" aria-labelledby="occasions-title">
          <p className="home-section__eyebrow">Для любого повода</p>
          <h2 id="occasions-title" className="home-section__title">Подарки не повторяются, а выбор остаётся красивым</h2>
          <div className="home-occasion-grid">
            {OCCASIONS.map((occasion) => (
              <Link className="home-occasion" href={occasion.href} key={occasion.href}>
                <span>{occasion.title}</span>
                <p>{occasion.text}</p>
                <svg className="home-occasion__icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
                  {occasion.href === "/wishlist/birthday" && <path d="M11 28h10M13 27V14h6v13m-3-16c-6-3 0-8 0-8s6 5 0 8Z" />}
                  {occasion.href === "/gifts/wedding" && <><circle cx="12" cy="18" r="7" /><circle cx="21" cy="18" r="7" /><path d="m16 7 2-3 2 3-2 3z" /></>}
                  {occasion.href === "/wishlist/new-year" && <path d="M16 3v26M5 9l22 14M5 23 27 9M12 6l4 4 4-4m-8 20 4-4 4 4M7 14l5-1-1-5m14 10-5 1 1 5M7 18l5 1-1 5m14-10-5-1 1-5" />}
                  {occasion.href === "/gifts/for-mom" && <path d="M16 28V17m0 6c-6-6-9-4-9-4s2 6 9 6m0-4c5-5 9-4 9-4s-2 6-9 6m0-6C5 13 8 7 13 9c-1-6 7-6 6 0 5-2 8 4-3 8Z" />}
                </svg>
              </Link>
            ))}
          </div>
        </section>

        <section id="how" className="home-section home-how" aria-labelledby="how-title">
          <p className="home-section__eyebrow">Как это работает</p>
          <h2 id="how-title" className="home-section__title">Три шага до подарка, который действительно нужен</h2>
          <ol className="home-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="home-step">
                <span className="home-step__number">{String(index + 1).padStart(2, "0")}</span>
                {index === 2 && <span className="home-step__gift"><GiftIcon /></span>}
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <HomeGiftCollections />

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

        <section id="faq" className="home-section home-faq" aria-labelledby="faq-title">
          <p className="home-section__eyebrow">Вопросы и ответы</p>
          <h2 id="faq-title" className="home-section__title">Частые вопросы о списке желаний</h2>
          <dl className="home-faq__list">
            {HOME_FAQ.map((item) => (
              <div className="home-faq__item" key={item.question}>
                <dt>{item.question}</dt>
                <dd>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        {!signedIn && (
        <section className="home-section home-finder home-final" aria-labelledby="final-title">
          <div>
            <p className="home-section__eyebrow">Начните сейчас</p>
            <h2 id="final-title" className="home-section__title">Соберите свой вишлист за минуту</h2>
            <p>Бесплатно, без установки приложений. Гостям не нужна регистрация.</p>
          </div>
          <div className="hero__actions">
            {createActions}
          </div>
        </section>
        )}

        <section id="about" className="home-section home-about" aria-labelledby="about-title">
          <p className="home-section__eyebrow">О нас</p>
          <h2 id="about-title" className="home-section__title">Вишлист без лишнего</h2>
          <p>
            MyWishList — бесплатный сервис для списков желаний. Он работает на сайте и в Telegram: добавляйте подарки
            из любых магазинов, отмечайте, чего хочется больше всего, и отправляйте близким одну ссылку. Гости видят,
            что уже выбрано, и бронируют подарок без регистрации, а вы не узнаете, кто и что подарит, до самого праздника.
          </p>
        </section>

        <section className="home-section">
          <OtherProjects placement="home" />
        </section>
      </main>

      <div className="home-footer">
        <SiteFooter botUsername={env.TELEGRAM_BOT_USERNAME} />
      </div>
    </div>
  );
}
