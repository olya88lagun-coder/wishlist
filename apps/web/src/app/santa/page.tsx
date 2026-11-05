import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { faqPageJsonLd } from "@/lib/structured-data";
import { SantaFrame } from "./SantaPresentation";
import styles from "./landing.module.css";

const TITLE = "Тайный Санта онлайн — жеребьёвка бесплатно | MyWishList";
const DESCRIPTION =
  "Проведите Тайного Санту онлайн: одна ссылка для всей компании, бесплатная жеребьёвка и вишлист у каждого участника. Участникам регистрация не нужна.";

const FAQ = [
  {
    question: "Сколько стоит провести Тайного Санту?",
    answer: "Игра бесплатная: создание, жеребьёвка и списки желаний не требуют оплаты.",
  },
  {
    question: "Нужна ли участникам регистрация?",
    answer: "Нет. Участник открывает ссылку, вводит имя и добавляет желания. Войти через Telegram можно по желанию, чтобы бот прислал результат жеребьёвки и напомнил о дате.",
  },
  {
    question: "Как проходит жеребьёвка?",
    answer: "Когда все вступили, организатор нажимает «Провести жеребьёвку». Каждый участник получает одного получателя, себе никто не дарит. Нужно минимум три человека.",
  },
  {
    question: "Узнает ли организатор, кто кому дарит?",
    answer: "Нет. Каждый видит только своего получателя, организатор тоже.",
  },
  {
    question: "Как узнать, что подарить?",
    answer: "У каждого участника свой вишлист. После жеребьёвки вы открываете список желаний получателя и выбираете подарок в рамках бюджета игры.",
  },
] as const;

// Игры и вступление закрыты от поиска в layout; эта страница — открытый вход для поисковых запросов
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/santa" },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "ru_RU", siteName: "MyWishList", url: "/santa" },
};

export default function SantaLandingPage() {
  return (
    <div className={styles.landing}>
      <SantaFrame>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Обмен подарками</p>
            <h1>Тайный Санта <em>онлайн</em></h1>
            <p className={styles.lead}>
              Бесплатная жеребьёвка для друзей и коллег. Пригласите всех одной ссылкой и выбирайте подарки по вишлистам.
            </p>
            <Link className={`button ${styles.heroButton}`} href="/santa/new">
              Создать игру <span aria-hidden="true">→</span>
            </Link>
            <p className={styles.heroNote}>Участие без регистрации</p>
          </div>
          <div className={styles.heroPhoto}>
            <Image
              src="/santa/gifts.webp"
              alt=""
              fill
              sizes="(max-width: 767px) 96vw, (max-width: 1232px) 50vw, 600px"
              fetchPriority="high"
              loading="eager"
            />
          </div>
        </header>

        <section className={styles.guide} aria-labelledby="santa-guide-title">
          <p className={styles.kicker}>От приглашения до подарка</p>
          <h2 id="santa-guide-title">Как проходит игра</h2>
          <ol className={styles.steps} role="list">
            <li>
              <span aria-hidden="true">01</span>
              <div>
                <h3>Создайте игру</h3>
                <p>Укажите название, бюджет и дату обмена подарками.</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <div>
                <h3>Отправьте ссылку в чат</h3>
                <p>Участники вступают по имени и добавляют желания.</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <div>
                <h3>Проведите жеребьёвку</h3>
                <p>Каждый узнает, кому дарит, и откроет его список желаний.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className={styles.faq} aria-labelledby="santa-faq-title">
          <div>
            <p className={styles.kicker}>Правила обмена</p>
            <h2 id="santa-faq-title">Вопросы и ответы</h2>
          </div>
          <div className={styles.questions}>
            {FAQ.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.invitation} aria-labelledby="santa-invitation-title">
          <div className={styles.invitationPhoto}>
            <Image src="/santa/envelope.webp" alt="" fill sizes="(max-width: 767px) 96vw, 400px" />
          </div>
          <div className={styles.invitationCopy}>
            <h2 id="santa-invitation-title">Кого позовёте играть?</h2>
            <Link className="button" href="/santa/new">
              Создать игру <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(FAQ)) }} />
      </SantaFrame>
    </div>
  );
}
