import styles from "./LetterScene.module.css";

// Письмо Деду Морозу: строки дописываются, лист уезжает в конверт, клапан закрывается, ставится печать.
// Анимация играет один раз, когда блок появился в экране (ScrollEffects добавляет is-visible)
export function LetterScene() {
  return (
    <section className={styles.section} aria-labelledby="letter-scene-title">
      <div className={styles.copy}>
        <p className={styles.kicker}>Как это выглядит</p>
        <h2 id="letter-scene-title">Письмо отправляется в конверт</h2>
        <p className={styles.text}>Напишите письмо вместе с ребёнком: имя, достижения за год и главное желание. Получится именной лист для печати на A4, который кладётся в конверт под ёлку.</p>
      </div>
      <figure className={styles.stage} data-landing-preview>
        <div className={styles.envelope} aria-hidden="true">
          <div className={styles.back} />
          <svg className={styles.flapOpen} viewBox="0 0 220 78" preserveAspectRatio="none">
            <path d="M1 1h218L128 67q-18 13-36 0Z" fill="#d9b574" stroke="#b1844b" />
          </svg>
          <div className={styles.slot}>
            <div className={styles.paper}>
              <p className={styles.hello}>Дорогой Дедушка Мороз!</p>
              <span className={styles.line} style={{ ["--w" as string]: "94%", ["--i" as string]: 0 }} />
              <span className={styles.line} style={{ ["--w" as string]: "82%", ["--i" as string]: 1 }} />
              <span className={styles.line} style={{ ["--w" as string]: "90%", ["--i" as string]: 2 }} />
              <p className={styles.sign}>Миша, 6 лет</p>
            </div>
          </div>
          <svg className={styles.pocket} viewBox="0 0 220 124" preserveAspectRatio="none">
            <path d="M1 1 110 79 219 1v116q0 6-6 6H7q-6 0-6-6Z" fill="#f4dfb5" stroke="#b1844b" />
            <path d="m4 118 70-63m142 63-70-63" fill="none" stroke="#b1844b" />
          </svg>
          <svg className={styles.flap} viewBox="0 0 220 78" preserveAspectRatio="none">
            <path d="M1 1h218L128 67q-18 13-36 0Z" fill="#e3be84" stroke="#b1844b" />
          </svg>
          <svg className={styles.seal} viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="20" fill="#862940" stroke="#ba5a65" strokeWidth="2" />
            <circle cx="22" cy="22" r="15" fill="none" stroke="#e2ad87" />
            <path d="M22 12v20m-8.7-15 17.4 10m0-10L13.3 27" stroke="#f7d4a9" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <figcaption className={styles.caption}>Ответ придёт под ёлку, с именем ребёнка</figcaption>
      </figure>
    </section>
  );
}
