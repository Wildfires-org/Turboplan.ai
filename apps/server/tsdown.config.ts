import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    local: "./src/local.ts",
  },
  format: ["esm"],
  platform: "node",
  // No need for .d.ts files for an application
  dts: false,
  clean: true,
  sourcemap: true,
  // Target Node.js runtime
  target: "node22",
  ignoreWatch: ["./.turbo", "./dist"],
});
