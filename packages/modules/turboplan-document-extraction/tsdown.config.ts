import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    "document-mime": "./src/document-mime.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  ignoreWatch: ["./.turbo", "./dist"],
});
