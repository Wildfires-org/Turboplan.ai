import preserveUseClient from "rollup-plugin-preserve-use-client";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    client: "./src/client.ts",
    server: "./src/server.ts",
    "types/index": "./src/types/index.ts",
    "components/index": "./src/components/index.ts",
    "hooks/index": "./src/hooks/index.ts",
    "providers/index": "./src/providers/index.ts",
    services: "./src/services/task-service.ts",
    "artifact/server": "./src/artifact/server.ts",
    "artifact/client": "./src/artifact/client.tsx",
    prompts: "./src/prompts.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  plugins: [preserveUseClient()],
  ignoreWatch: ["./.turbo", "./dist"],
});
