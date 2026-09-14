import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    server: "./src/server.ts",
    queries: "./src/queries.ts",
    types: "./src/types.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  ignoreWatch: ["./.turbo", "./dist"],
});
