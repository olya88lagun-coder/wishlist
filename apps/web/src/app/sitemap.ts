import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "https://my-wish-list.online";
  const giftSlugs = [
    "for-mom","for-dad","for-girlfriend","for-boyfriend","for-wife","for-husband","for-friend","for-colleague","for-sister","for-brother","for-grandma","for-grandpa","for-daughter","for-son","for-teacher","for-boss",
    "birthday","new-year","wedding","anniversary","housewarming","valentines-day","march-8","february-23","secret-santa","under-1000","under-3000","under-5000","under-10000","under-15000","under-20000",
  ];

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/gifts`, changeFrequency: "weekly", priority: 0.9 },
    ...giftSlugs.map((slug) => ({
      url: `${base}/gifts/${slug}`,
      changeFrequency: "monthly" as const,
      priority: slug.startsWith("for-") ? 0.7 : 0.65,
    })),
  ];
}
