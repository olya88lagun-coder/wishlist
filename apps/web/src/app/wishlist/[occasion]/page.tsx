import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_OG_IMAGES, SITE_NAME } from "@/content/og";
import { WISHLIST_LANDINGS, type WishlistLandingSlug } from "@/content/wishlist-landings";
import { SiteFooter } from "@/components/SiteFooter";
import { faqPageJsonLd } from "@/lib/structured-data";

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
    <main className="page page--wide gifts-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="eyebrow">my wish list · {page.eyebrow}</p>
      <h1 className="display">{page.heading}</h1>
      <p className="gifts-page__lead">{page.lead}</p>
      <p className="gifts-page__finder-link">
        <Link className="button" href="/lists">Создать вишлист бесплатно</Link>{" "}
        <Link className="button button--ghost" href={page.ideas.href}>{page.ideas.label}</Link>
      </p>

      <section className="gifts-page__seo">
        <h2>Как это работает</h2>
        {page.steps.map((step) => (
          <div key={step.title}>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </div>
        ))}
        {occasion === "new-year" && <p><Link href="/santa">Тайный Санта онлайн</Link> — бесплатная жеребьёвка для друзей и коллег.</p>}
      </section>

      <section className="gifts-page__seo">
        <h2>Частые вопросы</h2>
        {page.faq.map((item) => (
          <div key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </section>
      <SiteFooter />
    </main>
  );
}
