import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user } = await readViewer();
  if (user) redirect("/lists");
  const env = getEnv();

  return (
    <main className="landing-concept-page">
      <div className="landing-concept">
        <img
          className="landing-concept__image"
          src="/hero-premium.png.png"
          alt="MyWishList — премиальная страница сервиса списков желаний"
        />

        <nav className="landing-concept__hotspots" aria-label="Основная навигация">
          <a className="landing-hotspot landing-hotspot--home" href="/" aria-label="Главная" />
          <a className="landing-hotspot landing-hotspot--articles" href="#articles" aria-label="Статьи" />
          <a className="landing-hotspot landing-hotspot--how" href="#how-it-works" aria-label="Как это работает" />
          <a className="landing-hotspot landing-hotspot--login" href="/login" aria-label="Вход" />
          <a className="landing-hotspot landing-hotspot--create" href="/lists" aria-label="Создать список" />
        </nav>

        <div className="landing-concept__content-links" aria-label="Действия">
          <a
            className="landing-hotspot landing-hotspot--telegram"
            href={env.TELEGRAM_BOT_USERNAME ? `https://t.me/${env.TELEGRAM_BOT_USERNAME}` : "/lists"}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Собрать в Telegram"
          />
          <a className="landing-hotspot landing-hotspot--site"
            href="/lists"
            aria-label="Собрать на сайте"
          />
        </div>

        <section id="how-it-works" className="landing-concept__semantic landing-concept__semantic--steps" aria-labelledby="steps-title">
          <h1 id="steps-title">Как это работает</h1>
          <ol>
            <li>Добавляете желания из популярных магазинов.</li>
            <li>Делитесь списком с друзьями.</li>
            <li>Друзья выбирают подарки без повторов.</li>
          </ol>
        </section>

        <section id="articles" className="landing-concept__semantic landing-concept__semantic--articles" aria-labelledby="articles-title">
          <h2 id="articles-title">Статьи</h2>
          <p>Идеи подарков и вдохновение.</p>
        </section>
      </div>

      <div className="landing-concept__footer">
        <SiteFooter botUsername={env.TELEGRAM_BOT_USERNAME} />
      </div>
    </main>
  );
}
