import Image from "next/image";
import Link from "next/link";
import styles from "./SantaBanner.module.css";
import { SantaEnvelopeScene } from "./SantaEnvelopeScene";
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
        <SantaEnvelopeScene />
      </div>
    </section>
  );
}
