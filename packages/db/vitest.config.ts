import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "db", environment: "node", testTimeout: 30000, hookTimeout: 30000 },
});
