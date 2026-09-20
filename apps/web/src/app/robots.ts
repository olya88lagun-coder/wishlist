import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "https://my-wish-list.online";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/me", "/lists", "/login", "/go/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
