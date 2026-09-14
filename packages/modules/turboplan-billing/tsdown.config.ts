import preserveUseClient from "rollup-plugin-preserve-use-client";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    client: "./src/client.ts",
    server: "./src/server.ts",
    "types/index": "./src/types/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  plugins: [preserveUseClient()],
  ignoreWatch: ["./.turbo", "./dist"],
});
