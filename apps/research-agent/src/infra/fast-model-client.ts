import Anthropic from "@anthropic-ai/sdk";

import type { FastModelClientOptions } from "./model-provider";

export type FastModelCompleteParams = {
  system: string;
  prompt: string;
  maxTokens?: number;
  /** Per-attempt request timeout. The SDK default is 10 minutes. */
  timeoutMs?: number;
  /** Retries on connection errors, 408/409/429 and 5xx. The SDK default is 2. */
  maxRetries?: number;
};

export type FastModelClient = {
  complete(params: FastModelCompleteParams): Promise<string>;
};

export const createFastModelClient = (
  model: string,
  options: FastModelClientOptions | null = null,
): FastModelClient => {
  // With OpenRouter, auth goes via authToken (Authorization: Bearer);
  // apiKey: null keeps the SDK from also picking up ANTHROPIC_API_KEY.
  const client = options
    ? new Anthropic({
        baseURL: options.baseURL,
        authToken: options.authToken,
        apiKey: null,
      })
    : new Anthropic();

  return {
    async complete({ system, prompt, maxTokens = 256, timeoutMs, maxRetries }) {
      // Only set what the caller passed: the SDK spreads request options over
      // its own defaults, so an explicit `undefined` would still override them.
      const requestOptions = {
        ...(timeoutMs !== undefined ? { timeout: timeoutMs } : {}),
        ...(maxRetries !== undefined ? { maxRetries } : {}),
      };

      const response = await client.messages.create(
        {
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: prompt }],
        },
        requestOptions,
      );

      const block = response.content[0];
      if (!block || block.type !== "text") {
        throw new Error(
          `Unexpected response: ${block ? block.type : "empty content"}`,
        );
      }
      return block.text;
    },
  };
};
