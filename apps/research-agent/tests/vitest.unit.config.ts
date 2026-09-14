import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: join(__dirname, ".."),
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/helpers/setup.ts"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    passWithNoTests: false,
  },
});
