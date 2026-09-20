import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "https://my-wish-list.online";
  return [
    {
      url: base,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
