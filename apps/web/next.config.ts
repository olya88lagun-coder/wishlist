import path from "node:path";
import type { NextConfig } from "next";

// `next build` запускается из apps/web (pnpm --filter), корень монорепо — на два уровня выше
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@wishlist/core", "@wishlist/db"],
  poweredByHeader: false,
  // pg-boss тянет драйвер pg с опциональными нативными модулями: не бандлим, standalone-трассировка скопирует пакет
  serverExternalPackages: ["pg-boss"],
};

export default nextConfig;
