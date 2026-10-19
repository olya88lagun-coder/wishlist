import type { MetadataRoute } from "next";
import { ARTICLES } from "@/content/articles";
import { GIFT_IDEAS } from "@/content/gift-ideas";
import { CHILD_GIFT_COLLECTIONS, CHILDREN_HUB_SLUG, CHILDREN_CONTENT_UPDATED } from "@/content/children-gifts";

const GIFT_SLUGS = [
  "for-mom","for-dad","for-girlfriend","for-boyfriend","for-wife","for-husband","for-friend","for-colleague","for-sister","for-brother","for-grandma","for-grandpa","for-daughter","for-son","for-teacher","for-boss",
  "birthday","new-year","wedding","anniversary","housewarming","valentines-day","march-8","february-23","secret-santa","books","sport","under-1000","under-3000","under-5000","under-10000","under-15000","under-20000",
];

// Дата последней правки главной и страниц подарков; обновлять при заметных изменениях содержания
const CONTENT_UPDATED = new Date("2026-09-21");
// Страницы, на которые добавлены конкретные идеи подарков
const GIFT_IDEAS_UPDATED = new Date("2026-09-22");
const PUBLIC_PAGES_UPDATED = new Date("2026-10-01");

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.APP_URL ?? "https://my-wish-list.online").replace(/\/$/, "");

  return [
    { url: baseUrl, lastModified: PUBLIC_PAGES_UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/gifts`, lastModified: new Date(CHILDREN_CONTENT_UPDATED), changeFrequency: "weekly", priority: 0.9 },
    ...[CHILDREN_HUB_SLUG, ...CHILD_GIFT_COLLECTIONS.map(collection => collection.slug)].map(slug => ({
      url: `${baseUrl}/gifts/${slug}`,
      lastModified: new Date(CHILDREN_CONTENT_UPDATED),
      changeFrequency: "monthly" as const,
      priority: slug === CHILDREN_HUB_SLUG ? 0.8 : 0.7,
    })),
    ...GIFT_SLUGS.map((slug) => ({
      url: `${baseUrl}/gifts/${slug}`,
      lastModified: slug === "books" || slug === "sport" ? new Date("2026-10-14") : slug === "under-3000" ? new Date("2026-10-08") : GIFT_IDEAS[slug] ? GIFT_IDEAS_UPDATED : CONTENT_UPDATED,
      changeFrequency: "monthly" as const,
      priority: slug.startsWith("for-") ? 0.7 : 0.65,
    })),
    { url: `${baseUrl}/articles`, lastModified: new Date(Math.max(...ARTICLES.map((article) => new Date(article.updatedAt).getTime()))), changeFrequency: "weekly", priority: 0.8 },
    ...ARTICLES.map((article) => ({
      url: `${baseUrl}/articles/${article.slug}`,
      lastModified: new Date(article.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
