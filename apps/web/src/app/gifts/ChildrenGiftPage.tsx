import type { Metadata } from "next";
import Link from "next/link";
import { CHILD_GIFT_COLLECTIONS, CHILDREN_HUB_SLUG, CHILDREN_CONTENT_UPDATED, getChildGiftCollection } from "@/content/children-gifts";
import { CHILD_PARTNER_OFFERS } from "@/content/children-partner-offers";
import { DEFAULT_OG_IMAGES, SITE_NAME } from "@/content/og";
import { ChildPartnerCard } from "./ChildPartnerCard";
import "./children-gifts.css";

const HUB = {
  title: "Подарки детям от рождения до 7 лет — идеи по возрасту",
  heading: "Подарки детям: от рождения до 7 лет",
  description: "Выберите подарки ребёнку до года или на 1, 2, 3, 4, 5, 6 и 7 лет. Отдельные подборки по интересам, возрастные отметки и конкретные варианты.",
};

export function childrenMetadata(slug: string): Metadata | undefined {
  const page = slug === CHILDREN_HUB_SLUG ? HUB : getChildGiftCollection(slug);
  if (!page) return undefined;
  return {
    title: page.title, description: page.description,
    alternates: { canonical: `/gifts/${slug}` },
    openGraph: { title: page.title, description: page.description, url: `/gifts/${slug}`, siteName: SITE_NAME, images: DEFAULT_OG_IMAGES, locale: "ru_RU", type: "website" },
    twitter: { card: "summary_large_image", title: page.title, description: page.description, images: ["/opengraph-image.jpg"] },
  };
}

function AgeLinks({ current }: { current?: string }) {
  return <nav className="child-age-links" aria-label="Подарки по возрасту">
    {CHILD_GIFT_COLLECTIONS.map(collection => <Link key={collection.slug} href={`/gifts/${collection.slug}`} aria-current={current === collection.slug ? "page" : undefined}>{collection.label}</Link>)}
  </nav>;
}

function WishlistCta() {
  return <section className="child-wishlist">
    <div><p className="eyebrow">Подарок, которого ждут</p><h2>Соберите желания ребёнка в одном списке</h2><p>Добавьте несколько подходящих вариантов в вишлист и поделитесь с близкими. Так каждый сможет выбрать подарок по своему бюджету.</p></div>
    <Link className="button" href="/lists">Создать вишлист</Link>
  </section>;
}

export function ChildrenGiftPage({ slug }: { slug: string }) {
  const collection = getChildGiftCollection(slug);
  const page = collection ?? HUB;
  const base = (process.env.APP_URL ?? "https://my-wish-list.online").replace(/\/$/, "");
  const breadcrumbs = [
    { name: "MyWishList", href: "/" }, { name: "Идеи подарков", href: "/gifts" },
    ...(collection ? [{ name: "Подарки детям", href: `/gifts/${CHILDREN_HUB_SLUG}` }] : []),
    { name: collection?.label ?? "Подарки детям", href: `/gifts/${slug}` },
  ];
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebPage", name: page.title, description: page.description, url: `${base}/gifts/${slug}`, dateModified: CHILDREN_CONTENT_UPDATED },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: breadcrumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: `${base}${crumb.href}` })) },
  ];
  const products = collection ? CHILD_PARTNER_OFFERS.filter(offer => collection.productSkus.includes(offer.sku) || offer.optionalAges.includes(collection.age)) : [];

  return <main className="page page--wide gifts-page children-gifts">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <nav className="child-breadcrumbs" aria-label="Хлебные крошки">{breadcrumbs.map((crumb, index) => <span key={crumb.href}>{index > 0 && <span aria-hidden="true"> / </span>}{index === breadcrumbs.length - 1 ? <span aria-current="page">{crumb.name}</span> : <Link href={crumb.href}>{crumb.name}</Link>}</span>)}</nav>
    <p className="eyebrow">my wish list · подарки детям</p>
    <h1 className="display">{page.heading}</h1>
    <p className="gifts-page__lead">{collection?.intro ?? "Выберите возраст, затем любимую тему и формат игры. В каждой подборке — несколько направлений, вопросы для родителей и конкретные варианты. Возраст из каталога и найденные расхождения указаны рядом с товаром."}</p>
    <AgeLinks current={slug} />
    {collection ? <>
      <section className="child-section" aria-labelledby="child-criteria">
        <p className="eyebrow">Перед покупкой</p><h2 id="child-criteria">Как выбрать подарок</h2>
        <p className="child-focus">{collection.focus}</p>
        <ol className="child-criteria">{collection.criteria.map((criterion, index) => <li key={criterion}><span aria-hidden="true">0{index + 1}</span><p>{criterion}</p></li>)}</ol>
      </section>
      <section className="child-section" aria-labelledby="child-ideas"><p className="eyebrow">По интересам</p><h2 id="child-ideas">Направления для выбора</h2>
        <div className="child-ideas">{collection.ideas.map(idea => <article key={idea.title}><h3>{idea.title}</h3><p>{idea.text}</p></article>)}</div>
      </section>
      <section className="child-section" aria-labelledby="child-products"><p className="eyebrow">Конкретные варианты</p><h2 id="child-products">Посмотреть товары</h2>
        <p className="child-section__intro">Выбирайте по интересам ребёнка и сведениям о конкретном товаре. Если отметки расходятся, рядом указаны источники. Часть ссылок партнёрские: MyWishList может получить вознаграждение за покупку.</p>
        <div className="child-products">{products.map(offer => <ChildPartnerCard key={offer.sku} offer={offer} source={slug} />)}</div>
      </section>
      <section className="child-section" aria-labelledby="child-faq"><h2 id="child-faq">Частые вопросы</h2><div className="child-faq">{collection.faq.map(item => <div key={item.question}><h3>{item.question}</h3><p>{item.answer}</p></div>)}</div></section>
    </> : <>
      <section className="child-section" aria-labelledby="child-age-heading"><p className="eyebrow">Восемь подборок</p><h2 id="child-age-heading">Начните с возраста</h2>
        <div className="child-hub-grid">{CHILD_GIFT_COLLECTIONS.map(item => <Link key={item.slug} href={`/gifts/${item.slug}`}><span className="child-hub-grid__age">{item.label}</span><h3>{item.focus}</h3><p>{item.ideas.slice(0, 3).map(idea => idea.title).join(" · ")}</p><span className="child-hub-grid__link">Открыть подборку <span aria-hidden="true">↗</span></span></Link>)}</div>
      </section>
      <section className="child-section"><h2>Три вопроса, которые экономят время</h2><div className="child-ideas">
        <article><h3>Что уже есть дома?</h3><p>Попросите родителей назвать любимые игрушки и темы. Это поможет выбрать дополнение, а не дубль.</p></article>
        <article><h3>Как будут пользоваться подарком?</h3><p>Игра одному, занятие со взрослым или партия с друзьями требуют разных правил, места и подготовки.</p></article>
        <article><h3>Что означает возраст на коробке?</h3><p>Минимальная отметка и интерес ребёнка — разные вещи. В разделе до года уточняйте месяцы; при расхождениях сверяйте конкретную упаковку.</p></article>
      </div></section>
    </>}
    <WishlistCta />
    {collection && <section className="child-section"><h2>Другой возраст или бюджет</h2><AgeLinks current={slug} /><div className="quick-link__row"><Link href={`/gifts/${CHILDREN_HUB_SLUG}`}>Все подарки детям</Link><Link href="/gifts/under-3000">Подарки до 3 000 ₽</Link><Link href="/gifts/under-5000">Подарки до 5 000 ₽</Link></div></section>}
    <p className="child-updated">Подборка обновлена 8 октября 2026. Цена, наличие и сведения о товаре могут меняться.</p>
  </main>;
}
