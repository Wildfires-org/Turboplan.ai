import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

import { getAiModelConfig } from "@wildfires-org/turboplan-db/queries";
import { getOpenRouterEnv } from "@wildfires-org/turboplan-env";

type ModelSlot = "primary" | "lite";
type ImageModelSlot = "image-primary" | "image-lite";

export type ResolvedModelConfig = {
  primary: string;
  lite: string;
  imagePrimary: string;
  imageLite: string;
};

const CACHE_TTL_MS = 60_000;
let configCache: { config: ResolvedModelConfig; expiresAt: number } | null =
  null;

async function resolveModelConfig(): Promise<ResolvedModelConfig> {
  if (configCache && Date.now() < configCache.expiresAt) {
    return configCache.config;
  }

  const env = getOpenRouterEnv();

  let dbConfig: Awaited<ReturnType<typeof getAiModelConfig>> = null;
  try {
    dbConfig = await getAiModelConfig();
  } catch {
    console.warn(
      "[models] Failed to read AI model config from DB, using env/defaults",
    );
  }

  const config: ResolvedModelConfig = {
    primary: dbConfig?.primaryModel || env.OPENROUTER_MODEL_PRIMARY,
    lite: dbConfig?.liteModel || env.OPENROUTER_MODEL_LITE,
    imagePrimary:
      dbConfig?.imagePrimaryModel || env.OPENROUTER_MODEL_IMAGE_PRIMARY,
    imageLite: dbConfig?.imageLiteModel || env.OPENROUTER_MODEL_IMAGE_LITE,
  };

  configCache = { config, expiresAt: Date.now() + CACHE_TTL_MS };
  return config;
}

let _openRouterProvider: ReturnType<typeof createOpenRouter> | null = null;

const getOpenRouterProvider = () => {
  if (!_openRouterProvider) {
    const env = getOpenRouterEnv();
    _openRouterProvider = createOpenRouter({
      apiKey: env.OPENROUTER_API_KEY,
    });
  }
  return _openRouterProvider;
};

export async function getModel(type: ModelSlot): Promise<LanguageModel> {
  const config = await resolveModelConfig();
  const openrouter = getOpenRouterProvider();

  if (type === "lite") {
    return openrouter(config.lite, {
      // Usage accounting: response carries the exact provider cost in USD
      // (providerMetadata.openrouter.usage.cost) — the credit metering basis.
      usage: { include: true },
    });
  }

  // Enable Anthropic automatic prompt caching for the primary chat model. The
  // system prompt + project context + prior messages form a large, stable
  // prefix that is otherwise re-prefilled (~7s TTFT) on every turn. With an
  // ephemeral cache breakpoint, repeat turns within the TTL read the cached
  // prefix instead, cutting TTFT and token cost dramatically. 1h TTL comfortably
  // spans an active conversation.
  return openrouter(config.primary, {
    cache_control: { type: "ephemeral", ttl: "1h" },
    // Usage accounting: response carries the exact provider cost in USD
    // (providerMetadata.openrouter.usage.cost) — the credit metering basis.
    usage: { include: true },
  });
}

export async function getImageModel(type: ImageModelSlot): Promise<string> {
  const config = await resolveModelConfig();
  return type === "image-primary" ? config.imagePrimary : config.imageLite;
}
