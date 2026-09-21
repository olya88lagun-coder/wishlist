import type { Metadata } from "next";
import Link from "next/link";
import { ARTICLES } from "@/content/articles";

export const metadata: Metadata = {
  title: "Идеи подарков и полезные статьи",
  description:
    "Практические подборки подарков, советы по созданию вишлистов и идеи для разных поводов и бюджетов.",
  alternates: { canonical: "/articles" },
};

export default function ArticlesPage() {
  return (
    <main className="editorial-main">
      <p className="editorial-kicker">Журнал MyWishList</p>
      <h1>Идеи подарков<br /><em>без случайных покупок</em></h1>
      <p className="editorial-lead">
        Практические ориентиры для тех, кто выбирает подарок, и для тех, кто хочет
        деликатно рассказать близким о своих желаниях.
      </p>

      <div className="article-grid">
        {ARTICLES.map((article) => (
          <article className="article-card" key={article.slug}>
            <p>{article.kicker}</p>
            <h2>
              <Link href={`/articles/${article.slug}`}>{article.title}</Link>
            </h2>
            <span>{article.description}</span>
            <small>{article.readingMinutes} минут чтения</small>
          </article>
        ))}
      </div>
    </main>
  );
}
