import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    types: "./src/types.ts",
    "providers/index": "./src/providers/index.ts",
    "services/index": "./src/services/index.ts",
    "templates/index": "./src/templates/index.ts",
    "server/index": "./src/server/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  ignoreWatch: ["./.turbo", "./dist"],
});
