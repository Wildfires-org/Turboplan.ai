import { cp } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    "db-client/index": "./src/db-client/index.ts",
    "schemas/index": "./src/schemas/index.ts",
    "queries/index": "./src/queries/index.ts",
    "utils/index": "./src/utils/index.ts",
    "types/index": "./src/types/index.ts",
    "drizzle-config": "./drizzle.config.ts",
    migrate: "./src/migrate.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  ignoreWatch: ["./.turbo", "./dist"],
  onSuccess: async () => {
    const src = resolve(process.cwd(), "src/migrations");
    const dest = resolve(process.cwd(), "dist/migrations");
    await cp(src, dest, { recursive: true });
    console.log("✅ Migrations copied to dist/migrations");
  },
});
