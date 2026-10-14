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
      name: "Идеи подарков — AI-помощник",
      description: "Подбор подарков по получателю, поводу и бюджету, готовые подборки и сохранение в вишлист.",
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
