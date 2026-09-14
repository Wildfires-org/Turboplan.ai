import type { App, Image, ModalClient, Secret, Volume } from "modal";

import { getResearchAgentEnv } from "@wildfires-org/turboplan-env";

import { logger } from "../infra/logger";
import { getModelProviderEnv } from "./model-provider";

export type ModalResources = {
  client: ModalClient;
  app: App;
  image: Image;
  volume: Volume;
  sandboxEnv: Secret;
};

export const getModalResources = async (): Promise<ModalResources> => {
  const env = getResearchAgentEnv();

  const { ModalClient } = await import("modal");
  const client = new ModalClient();

  const app = await client.apps.fromName("research-agent-sandbox", {
    createIfMissing: true,
  });

  const image = client.images
    .fromRegistry("node:22")
    .dockerfileCommands([
      "RUN apt-get update && apt-get install -y jq && rm -rf /var/lib/apt/lists/*",
      "RUN npm install -g tsx@4.21.0 firecrawl-mcp@3.20.4 && mkdir -p /deps && cd /deps && npm init -y && npm install @anthropic-ai/claude-agent-sdk@0.2.37 && ln -sf /usr/local/bin/node /usr/bin/node",
      "ENV NODE_PATH=/deps/node_modules",
      "ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    ]);

  logger.log(
    "Building sandbox image (cached after first build)...",
    "deployment",
  );
  await image.build(app);
  logger.log("Image ready", "success");

  const volume = await client.volumes.fromName("research-agent-sandbox-code");

  const sandboxEnv = await client.secrets.fromObject({
    // getModelProviderEnv also supplies CLAUDE_MODEL — translated to an
    // OpenRouter slug when routing through OpenRouter. Do not re-add it here.
    ...getModelProviderEnv(env),
    DEBUG_CLAUDE_AGENT_SDK: env.DEBUG_CLAUDE_AGENT_SDK ? "true" : "false",
    FIRECRAWL_API_KEY: env.FIRECRAWL_API_KEY,
  });

  return { client, app, image, volume, sandboxEnv };
};
