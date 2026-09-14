import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    crypto: "./src/crypto.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  ignoreWatch: ["./.turbo", "./dist"],
});
