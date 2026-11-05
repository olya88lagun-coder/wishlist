import type { Metadata } from "next";
import Link from "next/link";
import { faqPageJsonLd } from "@/lib/structured-data";
import { SantaCover, SantaFrame } from "./SantaPresentation";

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
    <SantaFrame>
      <SantaCover eyebrow="Новогодняя игра" title={<>Тайный Санта <em>онлайн</em></>} artwork="gifts">
        <p className="santa-cover__lead">Бесплатная жеребьёвка для друзей и коллег. Одна ссылка в общий чат, у каждого свой вишлист, участникам без регистрации.</p>
        <Link className="button" href="/santa/new">Создать игру</Link>
      </SantaCover>
      <ol className="santa-steps" aria-label="Как проходит игра">
        <li><span aria-hidden="true">01</span><div><strong>Создайте игру</strong><p>Укажите название, бюджет и дату обмена подарками.</p></div></li>
        <li><span aria-hidden="true">02</span><div><strong>Отправьте ссылку в чат</strong><p>Участники вступают по имени и добавляют желания.</p></div></li>
        <li><span aria-hidden="true">03</span><div><strong>Проведите жеребьёвку</strong><p>Каждый узнает, кому дарит, и откроет его список желаний.</p></div></li>
      </ol>
      <section className="santa-paper" aria-labelledby="santa-faq-title">
        <h2 id="santa-faq-title">Вопросы и ответы</h2>
        {FAQ.map((item) => (
          <div key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(FAQ)) }} />
    </SantaFrame>
  );
}
