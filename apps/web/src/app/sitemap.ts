import type { MetadataRoute } from "next";
import { ARTICLES } from "@/content/articles";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.APP_URL ?? "https://my-wish-list.online").replace(/\/$/, "");

  return [
    {
      url: baseUrl,
      lastModified: new Date("2026-09-21"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/articles`,
      lastModified: new Date("2026-09-21"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...ARTICLES.map((article) => ({
      url: `${baseUrl}/articles/${article.slug}`,
      lastModified: new Date(article.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
