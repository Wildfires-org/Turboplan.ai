import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: join(__dirname, ".."),
  test: {
    include: ["tests/e2e/**/*.e2e.test.ts"],
    environment: "node",
    setupFiles: ["tests/helpers/setup.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    passWithNoTests: false,
  },
});
