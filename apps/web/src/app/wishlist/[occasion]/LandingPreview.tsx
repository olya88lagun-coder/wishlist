import Image from "next/image";
import styles from "./LandingPreview.module.css";

type Gift = { title: string; price: string; image: string; state: "free" | "booking" | "reserved" };
type Preview = { title: string; days: string; secret: string; text: string; gifts: readonly Gift[] };

const PREVIEWS: Record<string, Preview> = {
  birthday: {
    title: "День рождения Ани",
    days: "12 дней",
    secret: "Аня не узнает, кто подарил",
    text: "Друг открывает вашу ссылку, выбирает подарок и нажимает «Я подарю». Регистрация гостю не нужна, а вы видите только, что подарок уже выбран, — без имени дарителя.",
    gifts: [
      { title: "Настольная лампа", price: "3 290 ₽", image: "/landing/demo-lamp.webp", state: "booking" },
      { title: "Наушники", price: "5 990 ₽", image: "/landing/demo-headphones.webp", state: "reserved" },
      { title: "Набор акварели", price: "2 490 ₽", image: "/landing/demo-watercolors.webp", state: "free" },
    ],
  },
  "new-year": {
    title: "Новый год у Орловых",
    days: "48 дней",
    secret: "Сюрприз сохранится до ёлки",
    text: "Каждый видит, какие подарки уже выбраны, поэтому дублей не будет. А кто что подарит — вы узнаете только под ёлкой.",
    gifts: [
      { title: "Подарочная книга", price: "1 890 ₽", image: "/landing/demo-book.webp", state: "booking" },
      { title: "Настольная лампа", price: "3 290 ₽", image: "/landing/demo-lamp.webp", state: "reserved" },
      { title: "Набор акварели", price: "2 490 ₽", image: "/landing/demo-watercolors.webp", state: "free" },
    ],
  },
};

export function hasLandingPreview(occasion: string): boolean {
  return Object.hasOwn(PREVIEWS, occasion);
}

// «Так увидят гости»: гость нажимает «Я подарю», подарок помечается занятым, владелец не узнаёт, кто подарил.
// Анимация играет один раз, когда блок появился в экране (ScrollEffects добавляет is-visible)
export function LandingPreview({ occasion }: { occasion: string }) {
  const preview = PREVIEWS[occasion];
  if (!preview) return null;
  const free = preview.gifts.filter((gift) => gift.state !== "reserved").length;
  return (
    <section className={styles.section} aria-labelledby="landing-preview-title">
      <div className={styles.copy}>
        <p className={styles.kicker}>Глазами гостя</p>
        <h2 id="landing-preview-title">Так увидят ваш список</h2>
        <p className={styles.text}>{preview.text}</p>
      </div>
      <figure className={styles.preview} data-landing-preview>
        <figcaption className={styles.head}>
          <div>
            <p className={styles.eyebrow}>Пример вишлиста</p>
            <strong className={styles.title}>{preview.title}</strong>
          </div>
          <span className={styles.days}>{preview.days}</span>
        </figcaption>
        <ul className={styles.list}>
          {preview.gifts.map((gift) => (
            <li className={styles.row} data-state={gift.state} key={gift.title}>
              <span className={styles.thumb}>
                <Image src={gift.image} alt="" width={128} height={128} sizes="64px" />
              </span>
              <span>
                <strong className={styles.name}>{gift.title}</strong>
                <span className={styles.price}>{gift.price}</span>
              </span>
              <span className={styles.action}>
                <span className={styles.btn}>Я подарю</span>
                <span className={styles.stamp}>Забронировано</span>
                {gift.state === "booking" && (
                  <svg className={styles.cursor} viewBox="0 0 26 32" width="26" height="32" aria-hidden="true">
                    <path d="M3 2l20 17-9 1 3 7-4 2-4-8-6 6z" fill="#702338" stroke="#fff7e5" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.footer}>
          <span className={styles.counter}>
            <span className={styles.countBefore}>Свободно: {free}</span>
            <span className={styles.countAfter}>Свободно: {free - 1}</span>
          </span>
          <span className={styles.secret}>{preview.secret}</span>
        </p>
      </figure>
    </section>
  );
}
