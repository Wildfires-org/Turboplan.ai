import preserveUseClient from "rollup-plugin-preserve-use-client";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    client: "./src/client/index.ts",
    server: "./src/server/index.ts",
    types: "./src/types/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  plugins: [preserveUseClient()],
  ignoreWatch: ["./.turbo", "./dist"],
});
