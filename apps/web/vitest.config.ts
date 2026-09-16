import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
  // В tsconfig Next стоит jsx: "preserve" — для тестов JSX нужно компилировать самим
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  test: { name: "web", environment: "node", testTimeout: 30000, hookTimeout: 30000 },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
