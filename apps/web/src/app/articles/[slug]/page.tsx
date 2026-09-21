import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLES, getArticle } from "@/content/articles";

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.description,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      url: `/articles/${article.slug}`,
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const baseUrl = (process.env.APP_URL ?? "https://my-wish-list.online").replace(/\/$/, "");
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.description,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        inLanguage: "ru-RU",
        mainEntityOfPage: `${baseUrl}/articles/${article.slug}`,
        publisher: { "@type": "Organization", name: "MyWishList", url: baseUrl },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Главная", item: baseUrl },
          { "@type": "ListItem", position: 2, name: "Статьи", item: `${baseUrl}/articles` },
          {
            "@type": "ListItem",
            position: 3,
            name: article.title,
            item: `${baseUrl}/articles/${article.slug}`,
          },
        ],
      },
    ],
  };

  const related = ARTICLES.filter((item) => item.slug !== article.slug).slice(0, 3);

  return (
    <main className="article-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/">Главная</Link>
        <span>→</span>
        <Link href="/articles">Статьи</Link>
      </nav>

      <article>
        <header className="article-hero">
          <p className="editorial-kicker">{article.kicker}</p>
          <h1>{article.title}</h1>
          <p>{article.description}</p>
          <small>{article.readingMinutes} минут чтения · обновлено 21 сентября 2026</small>
        </header>

        <div className="article-body">
          {article.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}

          {article.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.items && (
                <ul>
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}

          <aside className="article-cta">
            <h2>Сохраните идеи в одном списке</h2>
            <p>Добавьте подходящие подарки и поделитесь ссылкой с близкими.</p>
            <Link href="/lists">Создать вишлист</Link>
          </aside>

          <section className="article-faq">
            <h2>Частые вопросы</h2>
            {article.faq.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </section>
        </div>
      </article>

      <section className="related-articles" aria-labelledby="related-title">
        <h2 id="related-title">Читайте также</h2>
        <div>
          {related.map((item) => (
            <Link key={item.slug} href={`/articles/${item.slug}`}>
              {item.title}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
