import preserveUseClient from "rollup-plugin-preserve-use-client";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    server: "./src/server.ts",
    session: "./src/session.ts",
    client: "./src/client.tsx",
    types: "./src/types.ts",
    hono: "./src/hono.ts",
    secrets: "./src/secrets.ts",
    "email-identity": "./src/email-identity.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  plugins: [preserveUseClient()],
  ignoreWatch: ["./.turbo", "./dist"],
  // Keep server-only as external - Next.js handles it specially
  // When inlined, it throws immediately which breaks server bundling
  external: ["server-only"],
});
