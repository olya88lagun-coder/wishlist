import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.APP_URL ?? "https://my-wish-list.online").replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/go/", "/lists", "/login", "/me", "/tg"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
