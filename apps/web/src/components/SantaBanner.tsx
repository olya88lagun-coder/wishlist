import Image from "next/image";
import Link from "next/link";
import styles from "./SantaBanner.module.css";
import { isSantaSeason } from "./santa-season";

export function SantaBanner({ eager = false }: { eager?: boolean }) {
  if (!isSantaSeason()) return null;
  return (
    <section className={styles.banner} aria-label="Игра «Тайный Санта»">
      <div className={styles.copy}>
        <p className={styles.kicker}>Новогодняя игра</p>
        <h2>У каждого подарка <em>есть секрет</em></h2>
        <p>Пригласите друзей одной ссылкой, обменяйтесь вишлистами и узнайте, кому готовить подарок.</p>
        <Link className={styles.link} href="/santa">Тайный Санта <span aria-hidden="true">→</span></Link>
      </div>
      <div className={`${styles.photo} ${styles.santaPhoto}`}>
        <Image src="/santa/gifts.webp" alt="" fill sizes="(max-width: 640px) 180vw, 1100px" loading={eager ? "eager" : "lazy"} />
        <div className={styles.scene} aria-hidden="true">
          <div className={styles.envelope}>
            <svg className={styles.flap} viewBox="0 0 220 78" preserveAspectRatio="none">
              <path d="M1 1h218L128 67q-18 13-36 0Z" fill="#e3be84" stroke="#b1844b" />
            </svg>
            <div className={styles.note}>Вы дарите <strong>???</strong></div>
            <svg className={styles.pocket} viewBox="0 0 220 124" preserveAspectRatio="none">
              <path d="M1 1 110 79 219 1v116q0 6-6 6H7q-6 0-6-6Z" fill="#f4dfb5" stroke="#b1844b" />
              <path d="m4 118 70-63m142 63-70-63" fill="none" stroke="#b1844b" />
            </svg>
            <svg className={styles.seal} viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="20" fill="#862940" stroke="#ba5a65" strokeWidth="2" />
              <circle cx="22" cy="22" r="15" fill="none" stroke="#e2ad87" />
              <path d="M22 12v20m-8.7-15 17.4 10m0-10L13.3 27" stroke="#f7d4a9" strokeWidth="1.6" strokeLinecap="round" />
              <path className={styles.crack} d="m24 3-6 10 7 7-6 6 3 6-5 9" fill="none" stroke="#4a1428" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
