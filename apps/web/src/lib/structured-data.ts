import { ARTICLES } from "@/content/articles";

const SITE_NAME = "MyWishList";

type Crumb = { name: string; url: string };

function breadcrumbList(crumbs: readonly Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList" as const,
    itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem" as const, position: index + 1, name: crumb.name, item: crumb.url })),
  };
}

export function giftsHubJsonLd(base: string) {
  const url = `${base}/gifts`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage" as const,
      name: "AI-подбор подарков: идеи по человеку, поводу и бюджету",
      description: "AI-помощник подбирает идеи подарков по получателю, поводу и бюджету. Есть готовые подборки и сохранение в вишлист.",
      url,
      inLanguage: "ru-RU",
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: base },
    },
    breadcrumbList([
      { name: SITE_NAME, url: base },
      { name: "Идеи подарков", url },
    ]),
  ] as const;
}

export function articlesHubJsonLd(base: string) {
  const url = `${base}/articles`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage" as const,
      name: "Идеи подарков и полезные статьи",
      url,
      inLanguage: "ru-RU",
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: base },
      mainEntity: {
        "@type": "ItemList" as const,
        itemListElement: ARTICLES.map((article, index) => ({
          "@type": "ListItem" as const,
          position: index + 1,
          name: article.title,
          url: `${base}/articles/${article.slug}`,
        })),
      },
    },
    breadcrumbList([
      { name: SITE_NAME, url: base },
      { name: "Статьи", url },
    ]),
  ] as const;
}

export function faqPageJsonLd(items: readonly { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: items.map((item) => ({
      "@type": "Question" as const,
      name: item.question,
      acceptedAnswer: { "@type": "Answer" as const, text: item.answer },
    })),
  };
}
