import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { ARTICLES } from "@/content/articles";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const STEPS = [
  {
    number: "01",
    title: "Добавляете желания",
    text: "Сохраните ссылку на нужный товар и коротко уточните важные детали.",
  },
  {
    number: "02",
    title: "Делитесь списком",
    text: "Отправьте одну ссылку близким в Telegram, VK или другом мессенджере.",
  },
  {
    number: "03",
    title: "Друзья выбирают",
    text: "Подарок бронируется без повторов, а для владельца сохраняется сюрприз.",
  },
] as const;

export default async function Home() {
  const { user } = await readViewer();
  if (user) redirect("/lists");

  const env = getEnv();
  const telegramHref = env.TELEGRAM_BOT_USERNAME
    ? `https://t.me/${env.TELEGRAM_BOT_USERNAME}`
    : "/lists";
  const featuredArticles = ARTICLES.slice(0, 3);

  return (
    <main className="landing-concept-page">
      <div className="landing-concept">
        <Image
          className="landing-concept__image"
          src="/hero-premium.png"
          alt="MyWishList — сервис списков желаний: подарки, которые правда хочется"
          width={1868}
          height={842}
          priority
          unoptimized
        />

        <nav className="landing-concept__hotspots" aria-label="Основная навигация">
          <Link className="landing-hotspot landing-hotspot--home" href="/" aria-label="Главная" />
          <Link className="landing-hotspot landing-hotspot--catalog" href="/articles" aria-label="Идеи подарков и статьи" />
          <a className="landing-hotspot landing-hotspot--how" href="#how-it-works" aria-label="Как это работает" />
          <a className="landing-hotspot landing-hotspot--about" href="#about" aria-label="О сервисе" />
          <Link className="landing-hotspot landing-hotspot--login" href="/login" aria-label="Войти" />
          <Link className="landing-hotspot landing-hotspot--create" href="/lists" aria-label="Создать список" />
        </nav>

        <div className="landing-concept__actions" aria-label="Создание списка желаний">
          <a
            className="landing-hotspot landing-hotspot--telegram"
            href={telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Собрать список в Telegram"
          />
          <Link className="landing-hotspot landing-hotspot--site" href="/lists" aria-label="Собрать список на сайте" />
        </div>

        <div className="landing-concept__semantic">
          <h1>Подарки, которые правда хочется</h1>
          <p>
            Соберите список желаний за минуту и поделитесь им. Друзья выберут подарок,
            и никто не подарит второй такой же.
          </p>
        </div>
      </div>

      <div className="landing-mobile-cta" aria-label="Создать список желаний">
        <a href={telegramHref} target="_blank" rel="noopener noreferrer">Собрать в Telegram</a>
        <Link href="/lists">Собрать на сайте</Link>
      </div>

      <section id="how-it-works" className="landing-info-section">
        <p className="landing-section-kicker">Три простых шага</p>
        <h2>Желания остаются вашими.<br /><em>Суета исчезает.</em></h2>
        <div className="landing-step-grid">
          {STEPS.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="articles" className="landing-info-section landing-journal">
        <div className="landing-section-heading">
          <div>
            <p className="landing-section-kicker">Журнал MyWishList</p>
            <h2>Выбирать подарки<br /><em>можно спокойно</em></h2>
          </div>
          <Link href="/articles">Все статьи →</Link>
        </div>
        <div className="landing-article-grid">
          {featuredArticles.map((article) => (
            <article key={article.slug}>
              <p>{article.kicker}</p>
              <h3><Link href={`/articles/${article.slug}`}>{article.title}</Link></h3>
              <span>{article.description}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="landing-about">
        <p className="landing-section-kicker">О сервисе</p>
        <h2>Один список —<br /><em>меньше случайных подарков</em></h2>
        <p>
          MyWishList помогает сохранить идеи из разных магазинов, поделиться ими одной
          ссылкой и избежать повторных покупок. Гости бронируют подарок, а владелец
          списка не видит, кто что выбрал.
        </p>
        <Link href="/lists">Создать свой список</Link>
      </section>

      <div className="landing-footer-wrap">
        <SiteFooter botUsername={env.TELEGRAM_BOT_USERNAME} />
      </div>
    </main>
  );
}
