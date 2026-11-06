import path from "node:path";
import type { NextConfig } from "next";

// `next build` запускается из apps/web (pnpm --filter), корень монорепо — на два уровня выше
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@wishlist/core", "@wishlist/db"],
  poweredByHeader: false,
  // Статья дублировала подборку /gifts/under-3000, и в Google они делили один запрос
  async redirects() {
    return [{ source: "/articles/podarki-do-3000-rubley", destination: "/gifts/under-3000", permanent: true }];
  },
  // pg-boss тянет драйвер pg с опциональными нативными модулями: не бандлим, standalone-трассировка скопирует пакет
  serverExternalPackages: ["pg-boss"],
  // Базовые защитные заголовки. CSP не задаём: Метрика и партнёрские скрипты потребуют отдельного списка источников.
  // X-Frame-Options не ставим: Telegram Mini App в web.telegram.org открывает сайт в iframe
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
