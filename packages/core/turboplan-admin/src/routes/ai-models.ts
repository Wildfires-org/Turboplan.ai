import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  getAiModelConfig,
  upsertAiModelConfig,
} from "@wildfires-org/turboplan-db/queries";
import { getOpenRouterEnv } from "@wildfires-org/turboplan-env";
import type { RBACContext } from "@wildfires-org/turboplan-rbac/hono";

import type { ModelKey, ModelValues } from "../types";

type ConfigResponse = Record<ModelKey, ModelValues>;

const buildConfigResponse = (
  dbConfig: Awaited<ReturnType<typeof getAiModelConfig>>,
): ConfigResponse => {
  const env = getOpenRouterEnv();

  const createModelValues = (
    currentValue: string | null | undefined,
    envValue: string,
  ): ModelValues => ({
    defaultValue: envValue,
    currentValue: currentValue ?? null,
  });

  return {
    primary: createModelValues(
      dbConfig?.primaryModel,
      env.OPENROUTER_MODEL_PRIMARY,
    ),
    lite: createModelValues(dbConfig?.liteModel, env.OPENROUTER_MODEL_LITE),
    imagePrimary: createModelValues(
      dbConfig?.imagePrimaryModel,
      env.OPENROUTER_MODEL_IMAGE_PRIMARY,
    ),
    imageLite: createModelValues(
      dbConfig?.imageLiteModel,
      env.OPENROUTER_MODEL_IMAGE_LITE,
    ),
  };
};

const aiModelsRouter = new Hono<RBACContext>();

/**
 * GET /
 * Returns the current model configuration with resolved values
 * and source indicators (db / env / default) per slot.
 */
aiModelsRouter.get("/", async (c) => {
  try {
    const dbConfig = await getAiModelConfig();
    const config = buildConfigResponse(dbConfig);
    return c.json({ config });
  } catch (error) {
    console.error("Failed to get AI model config:", error);
    return c.json({ error: "Failed to get AI model config" }, 500);
  }
});

/**
 * PUT /
 * Validates and upserts model config.
 * Null values mean "use env/default".
 */
aiModelsRouter.put(
  "/",
  zValidator(
    "json",
    z.object({
      primaryModel: z.string().nullable(),
      liteModel: z.string().nullable(),
      imagePrimaryModel: z.string().nullable(),
      imageLiteModel: z.string().nullable(),
    }),
  ),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const userId = c.get("user").userId;

      await upsertAiModelConfig(body, userId);

      const dbConfig = await getAiModelConfig();
      const config = buildConfigResponse(dbConfig);

      return c.json({ config });
    } catch (error) {
      console.error("Failed to update AI model config:", error);
      return c.json({ error: "Failed to update AI model config" }, 500);
    }
  },
);

type OpenRouterModel = {
  id: string;
  name: string;
  architecture: {
    output_modalities: string[];
  };
};

/**
 * GET /available
 * Proxies OpenRouter's model list (requires API key), categorizes each model
 * as language or image, and returns a sorted list. No server-side cache —
 * caching is handled client-side by SWR.
 */
aiModelsRouter.get("/available", async (c) => {
  try {
    const env = getOpenRouterEnv();

    // Metering exemption: this fetches OpenRouter's model LIST (metadata,
    // free) — no inference happens here, so there is nothing to bill.
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error(
        `OpenRouter API error: ${response.status} ${response.statusText}`,
      );
      return c.json({ error: "Failed to fetch models from OpenRouter" }, 502);
    }

    const json = (await response.json()) as { data: OpenRouterModel[] };

    const language: Array<{ id: string; name: string }> = [];
    const image: Array<{ id: string; name: string }> = [];

    for (const m of json.data) {
      const entry = { id: m.id, name: m.name };
      if (m.architecture?.output_modalities?.includes("image")) {
        image.push(entry);
      } else {
        language.push(entry);
      }
    }

    language.sort((a, b) => a.id.localeCompare(b.id));
    image.sort((a, b) => a.id.localeCompare(b.id));

    return c.json({ language, image });
  } catch (error) {
    console.error("Failed to fetch available models:", error);
    return c.json({ error: "Failed to fetch models from OpenRouter" }, 502);
  }
});

export { aiModelsRouter };
