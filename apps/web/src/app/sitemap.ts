import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "https://my-wish-list.online";
  const recipientSlugs = [
    "for-mom",
    "for-dad",
    "for-girlfriend",
    "for-boyfriend",
    "for-wife",
    "for-husband",
    "for-friend",
    "for-colleague",
  ];

  return [
    {
      url: base,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/gifts`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...recipientSlugs.map((slug) => ({
      url: `${base}/gifts/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
