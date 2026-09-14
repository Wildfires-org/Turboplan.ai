import preserveUseClient from "rollup-plugin-preserve-use-client";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    server: "./src/server.ts",
    client: "./src/client.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  plugins: [preserveUseClient()],
  ignoreWatch: ["./.turbo", "./dist"],
});
