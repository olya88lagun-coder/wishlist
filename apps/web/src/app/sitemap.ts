import type { MetadataRoute } from "next";
import { ARTICLES } from "@/content/articles";

const GIFT_SLUGS = [
  "for-mom","for-dad","for-girlfriend","for-boyfriend","for-wife","for-husband","for-friend","for-colleague","for-sister","for-brother","for-grandma","for-grandpa","for-daughter","for-son","for-teacher","for-boss",
  "birthday","new-year","wedding","anniversary","housewarming","valentines-day","march-8","february-23","secret-santa","under-1000","under-3000","under-5000","under-10000","under-15000","under-20000",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.APP_URL ?? "https://my-wish-list.online").replace(/\/$/, "");

  return [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/gifts`, changeFrequency: "weekly", priority: 0.9 },
    ...GIFT_SLUGS.map((slug) => ({
      url: `${baseUrl}/gifts/${slug}`,
      changeFrequency: "monthly" as const,
      priority: slug.startsWith("for-") ? 0.7 : 0.65,
    })),
    { url: `${baseUrl}/articles`, changeFrequency: "weekly", priority: 0.8 },
    ...ARTICLES.map((article) => ({
      url: `${baseUrl}/articles/${article.slug}`,
      lastModified: new Date(article.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
