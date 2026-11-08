import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_OG_IMAGES, SITE_NAME } from "@/content/og";
import { WISHLIST_LANDINGS, type WishlistLandingSlug } from "@/content/wishlist-landings";
import { SiteFooter } from "@/components/SiteFooter";
import { faqPageJsonLd } from "@/lib/structured-data";
import styles from "./landing.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(WISHLIST_LANDINGS).map((occasion) => ({ occasion }));
}

function landing(occasion: string) {
  return Object.hasOwn(WISHLIST_LANDINGS, occasion) ? WISHLIST_LANDINGS[occasion as WishlistLandingSlug] : null;
}

export async function generateMetadata({ params }: { params: Promise<{ occasion: string }> }): Promise<Metadata> {
  const page = landing((await params).occasion);
  if (!page) return {};
  const url = `/wishlist/${(await params).occasion}`;
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: url },
    openGraph: { title: page.title, description: page.description, url, siteName: SITE_NAME, images: DEFAULT_OG_IMAGES, locale: "ru_RU", type: "website" },
  };
}

// Список создаётся на /lists: гостя оттуда отправит на вход, а после входа вернёт к созданию
export default async function WishlistLandingPage({ params }: { params: Promise<{ occasion: string }> }) {
  const { occasion } = await params;
  const page = landing(occasion);
  if (!page) notFound();
  const base = process.env.APP_URL ?? "https://my-wish-list.online";
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebPage", name: page.heading, description: page.description, url: `${base}/wishlist/${occasion}`, dateModified: page.updated, isPartOf: { "@type": "WebSite", name: SITE_NAME, url: base } },
    faqPageJsonLd(page.faq),
  ];
  return (
    <main className={styles.landing} data-occasion={occasion}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className={styles.content}>
        <div className={styles.masthead}>
          <Link href="/" aria-label="MyWishList — на главную">MyWishList</Link>
          <span>Списки желаний</span>
        </div>
        <header className={styles.hero}>
          <div className={styles.copy}>
            <p className={styles.kicker}>Подарки, которые хочется получить</p>
            <h1>{page.heading}</h1>
            <p className={styles.lead}>{page.lead}</p>
            <div className={styles.actions}>
              <Link className={`button ${styles.create}`} href="/lists">{"cta" in page ? page.cta : "Создать вишлист бесплатно"}</Link>
              <Link className={styles.ideas} href={page.ideas.href}>{page.ideas.label}</Link>
              {occasion === "pismo-dedu-morozu" && (
                <a className={styles.ideas} href="/blank-pismo-dedu-morozu.pdf" download>Скачать бланк</a>
              )}
            </div>
          </div>
          <div className={styles.photo}>
            <Image
              src={`/landing/wishlist-${occasion}.webp`}
              alt=""
              fill
              sizes="(max-width: 767px) 94vw, (max-width: 1200px) 48vw, 570px"
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </header>

        <section className={styles.guide} aria-labelledby="wishlist-guide">
          <p className={styles.kicker}>От идеи до подарка</p>
          <h2 id="wishlist-guide">Как это работает</h2>
          <ol className={styles.steps} role="list">
            {page.steps.map((step, index) => (
              <li key={step.title}>
                <span aria-hidden="true">0{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          {(occasion === "new-year" || occasion === "pismo-dedu-morozu") && (
            <p className={styles.santa}><Link href="/santa">Тайный Санта онлайн</Link> — бесплатная жеребьёвка для друзей и коллег.</p>
          )}
        </section>

        <section className={styles.faq} aria-labelledby="wishlist-faq">
          <h2 id="wishlist-faq">Частые вопросы</h2>
          <div className={styles.questions}>
            {page.faq.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}
