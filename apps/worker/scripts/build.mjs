import { build } from "esbuild";

// Воркер собирается в один ESM-файл: workspace-пакеты экспортируют .ts, а Node не резолвит их импорты без расширений.
// sharp остаётся внешним: у него нативный бинарник, он берётся из node_modules образа.
await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  outfile: "dist/main.mjs",
  external: ["sharp", "pg-native"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});
