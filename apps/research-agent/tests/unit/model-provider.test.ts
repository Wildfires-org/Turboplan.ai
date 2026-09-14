import { describe, expect, it } from "vitest";

import {
  getFastModelClientOptions,
  getFastModelId,
  getModelProviderEnv,
  getModelProviderName,
  OPENROUTER_ANTHROPIC_BASE_URL,
  toOpenRouterModel,
} from "../../src/infra/model-provider";

describe("getModelProviderEnv", () => {
  it("routes through OpenRouter when OPENROUTER_API_KEY is set", () => {
    const result = getModelProviderEnv({
      ANTHROPIC_API_KEY: "sk-ant-direct",
      OPENROUTER_API_KEY: "sk-or-key",
      CLAUDE_MODEL: "claude-sonnet-4-6",
    });

    expect(result).toEqual({
      ANTHROPIC_BASE_URL: OPENROUTER_ANTHROPIC_BASE_URL,
      ANTHROPIC_AUTH_TOKEN: "sk-or-key",
      // Per OpenRouter docs, must be explicitly empty to avoid auth conflicts
      ANTHROPIC_API_KEY: "",
      // OpenRouter's catalog has no bare Anthropic IDs — they 404 at runtime
      CLAUDE_MODEL: "anthropic/claude-sonnet-4.6",
    });
  });

  it("passes the Anthropic key and bare model ID through when OpenRouter is not configured", () => {
    const result = getModelProviderEnv({
      ANTHROPIC_API_KEY: "sk-ant-direct",
      OPENROUTER_API_KEY: "",
      CLAUDE_MODEL: "claude-sonnet-4-6",
    });

    expect(result).toEqual({
      ANTHROPIC_API_KEY: "sk-ant-direct",
      CLAUDE_MODEL: "claude-sonnet-4-6",
    });
    expect(result).not.toHaveProperty("ANTHROPIC_BASE_URL");
    expect(result).not.toHaveProperty("ANTHROPIC_AUTH_TOKEN");
  });
});

describe("toOpenRouterModel", () => {
  it("maps the model IDs this repo ships to OpenRouter slugs", () => {
    expect(toOpenRouterModel("claude-sonnet-4-6")).toBe(
      "anthropic/claude-sonnet-4.6",
    );
    expect(toOpenRouterModel("claude-haiku-4-5-20251001")).toBe(
      "anthropic/claude-haiku-4.5",
    );
    expect(toOpenRouterModel("claude-sonnet-4-5-20250929")).toBe(
      "anthropic/claude-sonnet-4.5",
    );
  });

  it("strips the snapshot date and dots the version for unmapped claude IDs", () => {
    expect(toOpenRouterModel("claude-sonnet-9-1-20301231")).toBe(
      "anthropic/claude-sonnet-9.1",
    );
    expect(toOpenRouterModel("claude-opus-5")).toBe("anthropic/claude-opus-5");
  });

  it("leaves values that already carry a provider prefix untouched", () => {
    expect(toOpenRouterModel("anthropic/claude-sonnet-4.6")).toBe(
      "anthropic/claude-sonnet-4.6",
    );
    expect(toOpenRouterModel("openai/gpt-5")).toBe("openai/gpt-5");
  });

  it("leaves non-Claude IDs untouched", () => {
    expect(toOpenRouterModel("some-other-model")).toBe("some-other-model");
  });
});

describe("getFastModelId", () => {
  it("translates the fast model to an OpenRouter slug when routing through OpenRouter", () => {
    expect(
      getFastModelId({
        ANTHROPIC_API_KEY: "sk-ant-direct",
        OPENROUTER_API_KEY: "sk-or-key",
        CLAUDE_FAST_MODEL: "claude-haiku-4-5-20251001",
      }),
    ).toBe("anthropic/claude-haiku-4.5");
  });

  it("keeps the bare Anthropic ID on the direct path", () => {
    expect(
      getFastModelId({
        ANTHROPIC_API_KEY: "sk-ant-direct",
        OPENROUTER_API_KEY: "",
        CLAUDE_FAST_MODEL: "claude-haiku-4-5-20251001",
      }),
    ).toBe("claude-haiku-4-5-20251001");
  });

  it("returns null when no fast model is configured", () => {
    expect(
      getFastModelId({
        ANTHROPIC_API_KEY: "sk-ant-direct",
        OPENROUTER_API_KEY: "sk-or-key",
        CLAUDE_FAST_MODEL: null,
      }),
    ).toBeNull();
  });
});

describe("getFastModelClientOptions", () => {
  it("returns OpenRouter options when OPENROUTER_API_KEY is set", () => {
    const result = getFastModelClientOptions({
      ANTHROPIC_API_KEY: "sk-ant-direct",
      OPENROUTER_API_KEY: "sk-or-key",
    });

    expect(result).toEqual({
      baseURL: OPENROUTER_ANTHROPIC_BASE_URL,
      authToken: "sk-or-key",
    });
  });

  it("returns null when OpenRouter is not configured", () => {
    const result = getFastModelClientOptions({
      ANTHROPIC_API_KEY: "sk-ant-direct",
      OPENROUTER_API_KEY: "",
    });

    expect(result).toBeNull();
  });
});

describe("getModelProviderName", () => {
  it("resolves to openrouter when the key is set", () => {
    expect(
      getModelProviderName({
        ANTHROPIC_API_KEY: "sk-ant-direct",
        OPENROUTER_API_KEY: "sk-or-key",
      }),
    ).toBe("openrouter");
  });

  it("resolves to anthropic otherwise", () => {
    expect(
      getModelProviderName({
        ANTHROPIC_API_KEY: "sk-ant-direct",
        OPENROUTER_API_KEY: "",
      }),
    ).toBe("anthropic");
  });
});
