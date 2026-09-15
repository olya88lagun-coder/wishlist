import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "worker", environment: "node", testTimeout: 30000, hookTimeout: 30000 },
});
