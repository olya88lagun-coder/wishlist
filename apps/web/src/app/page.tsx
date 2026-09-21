import Image from "next/image";
import { redirect } from "next/navigation";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user } = await readViewer();
  if (user) redirect("/lists");

  const env = getEnv();
  const telegramHref = env.TELEGRAM_BOT_USERNAME
    ? `https://t.me/${env.TELEGRAM_BOT_USERNAME}`
    : "/lists";

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
          <a className="landing-hotspot landing-hotspot--home" href="/" aria-label="Главная" />
          <a className="landing-hotspot landing-hotspot--catalog" href="#articles" aria-label="Каталог идей подарков" />
          <a className="landing-hotspot landing-hotspot--how" href="#how-it-works" aria-label="Как это работает" />
          <a className="landing-hotspot landing-hotspot--about" href="#about" aria-label="О сервисе" />
          <a className="landing-hotspot landing-hotspot--login" href="/login" aria-label="Войти" />
          <a className="landing-hotspot landing-hotspot--create" href="/lists" aria-label="Создать список" />
        </nav>

        <div className="landing-concept__actions" aria-label="Создание списка желаний">
          <a
            className="landing-hotspot landing-hotspot--telegram"
            href={telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Собрать список в Telegram"
          />
          <a
            className="landing-hotspot landing-hotspot--site"
            href="/lists"
            aria-label="Собрать список на сайте"
          />
        </div>

        <div className="landing-concept__semantic">
          <h1>Подарки, которые правда хочется</h1>
          <p>
            Соберите список желаний за минуту и поделитесь им. Друзья выберут подарок,
            и никто не подарит второй такой же.
          </p>
          <section id="how-it-works">
            <h2>Как это работает</h2>
            <ol>
              <li>Добавляете желания из популярных магазинов.</li>
              <li>Делитесь списком с друзьями.</li>
              <li>Друзья выбирают подарки без повторов.</li>
            </ol>
          </section>
          <section id="articles">
            <h2>Идеи подарков и полезные статьи</h2>
          </section>
          <section id="about">
            <h2>О сервисе MyWishList</h2>
          </section>
        </div>
      </div>

      <div className="landing-mobile-cta" aria-label="Создать список желаний">
        <a href={telegramHref} target="_blank" rel="noopener noreferrer">
          Собрать в Telegram
        </a>
        <a href="/lists">Собрать на сайте</a>
      </div>
    </main>
  );
}
