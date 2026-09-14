// Model provider selection: direct Anthropic API vs OpenRouter's
// Anthropic-compatible endpoint ("Anthropic Skin"). Routing through OpenRouter
// gives per-key cost tracking in the OpenRouter Activity dashboard.
//
// Toggle: when OPENROUTER_API_KEY is set, all agent traffic routes through
// OpenRouter; otherwise the direct Anthropic key is used unchanged.

export const OPENROUTER_ANTHROPIC_BASE_URL = "https://openrouter.ai/api";

export type ModelProviderName = "openrouter" | "anthropic";

type ProviderKeys = {
  ANTHROPIC_API_KEY: string;
  OPENROUTER_API_KEY: string;
};

type AgentModelEnv = ProviderKeys & {
  CLAUDE_MODEL: string;
};

type FastModelEnv = ProviderKeys & {
  CLAUDE_FAST_MODEL: string | null;
};

/**
 * OpenRouter routes by its own catalog slugs, not by Anthropic model IDs. The
 * Anthropic Skin only maps the request *shape* — the model string is looked up
 * verbatim, and bare IDs are not in the catalog (`GET /api/v1/models/
 * claude-sonnet-4-6/endpoints` → 404, while `anthropic/claude-sonnet-4.6`
 * resolves). Slugs use dotted versions and never carry a date suffix.
 *
 * Translating here keeps CLAUDE_MODEL / CLAUDE_FAST_MODEL as plain Anthropic
 * IDs in fly.toml and .env — the operator never edits them to switch provider,
 * and the direct-Anthropic path keeps using them unchanged.
 */
const OPENROUTER_MODEL_SLUGS: Record<string, string> = {
  "claude-sonnet-4-6": "anthropic/claude-sonnet-4.6",
  "claude-sonnet-4-5-20250929": "anthropic/claude-sonnet-4.5",
  "claude-haiku-4-5-20251001": "anthropic/claude-haiku-4.5",
};

/**
 * Anthropic model ID → OpenRouter slug. The map above is authoritative for the
 * IDs this repo ships; anything else falls back to dropping the `-YYYYMMDD`
 * snapshot suffix and dotting the trailing `-major-minor` pair, which is
 * best-effort for current-generation IDs only. Values already carrying a
 * provider prefix (`anthropic/…`, `openai/…`) and non-Claude IDs pass through
 * untouched, so an operator can pin an exact OpenRouter slug.
 */
export const toOpenRouterModel = (modelId: string): string => {
  const mapped = OPENROUTER_MODEL_SLUGS[modelId];
  if (mapped) {
    return mapped;
  }
  if (modelId.includes("/") || !modelId.startsWith("claude-")) {
    return modelId;
  }
  const dotted = modelId
    .replace(/-\d{8}$/, "")
    .replace(/-(\d+)-(\d+)$/, "-$1.$2");
  return `anthropic/${dotted}`;
};

/**
 * Env vars consumed by the Claude Agent SDK inside the sandbox (Modal secret)
 * or the local child process.
 *
 * Per OpenRouter docs, ANTHROPIC_API_KEY must be explicitly empty when using
 * ANTHROPIC_AUTH_TOKEN to prevent auth conflicts.
 */
export const getModelProviderEnv = (
  env: AgentModelEnv,
): Record<string, string> => {
  if (env.OPENROUTER_API_KEY) {
    return {
      ANTHROPIC_BASE_URL: OPENROUTER_ANTHROPIC_BASE_URL,
      ANTHROPIC_AUTH_TOKEN: env.OPENROUTER_API_KEY,
      ANTHROPIC_API_KEY: "",
      CLAUDE_MODEL: toOpenRouterModel(env.CLAUDE_MODEL),
    };
  }
  return {
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    CLAUDE_MODEL: env.CLAUDE_MODEL,
  };
};

export type FastModelClientOptions = {
  baseURL: string;
  authToken: string;
};

/** Options for the in-process @anthropic-ai/sdk fast-model client. */
export const getFastModelClientOptions = (
  env: ProviderKeys,
): FastModelClientOptions | null => {
  if (env.OPENROUTER_API_KEY) {
    return {
      baseURL: OPENROUTER_ANTHROPIC_BASE_URL,
      authToken: env.OPENROUTER_API_KEY,
    };
  }
  return null;
};

/**
 * Fast-model ID for the active provider — translated to an OpenRouter slug when
 * routing through OpenRouter. Null when no fast model is configured.
 */
export const getFastModelId = (env: FastModelEnv): string | null => {
  if (!env.CLAUDE_FAST_MODEL) {
    return null;
  }
  if (env.OPENROUTER_API_KEY) {
    return toOpenRouterModel(env.CLAUDE_FAST_MODEL);
  }
  return env.CLAUDE_FAST_MODEL;
};

/** Which provider the current env resolves to — for logging, never log key values. */
export const getModelProviderName = (env: ProviderKeys): ModelProviderName => {
  return env.OPENROUTER_API_KEY ? "openrouter" : "anthropic";
};
