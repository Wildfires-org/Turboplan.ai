import preserveUseClient from "rollup-plugin-preserve-use-client";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    server: "./src/server.ts",
    // Own entry (not folded into ./server) so Cloudflare Workers can import the
    // classifier without pulling in the React/Node-flavoured server barrel.
    ssrf: "./src/ssrf.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  plugins: [preserveUseClient()],
  ignoreWatch: ["./.turbo", "./dist"],
});
