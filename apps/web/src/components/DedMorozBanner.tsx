import Image from "next/image";
import Link from "next/link";
import styles from "./SantaBanner.module.css";
import { isDedMorozSeason } from "./santa-season";

// Тот же вид, что у баннера Тайного Санты; показывается только в сезон (santa-season.ts)
export function DedMorozBanner() {
  if (!isDedMorozSeason()) return null;
  return (
    <section className={styles.banner} aria-label="Письмо от Деда Мороза">
      <div className={styles.copy}>
        <p className={styles.kicker}>Новинка к Новому году</p>
        <h2>Письмо Деду Морозу <em>и ответ от него</em></h2>
        <p>Ребёнок пишет, о чём мечтает, родные бронируют подарки без повторов, а под ёлкой ждёт именное письмо от Деда Мороза.</p>
        <Link className={styles.link} href="/wishlist/pismo-dedu-morozu">Письмо Деду Морозу <span aria-hidden="true">→</span></Link>
      </div>
      <div className={styles.photo}>
        <Image src="/landing/wishlist-pismo-dedu-morozu.webp" alt="" fill sizes="(max-width: 640px) 100vw, 612px" loading="lazy" />
      </div>
    </section>
  );
}
