import preserveUseClient from "rollup-plugin-preserve-use-client";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    server: "./src/server.ts",
    // Own entries so client modules (AppUrls, loading boundaries) and e2e get
    // path builders and slug rules without the `'use client'` root barrel or
    // the env-reading server barrel.
    "app-paths": "./src/app-paths.ts",
    slug: "./src/slug.ts",
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
