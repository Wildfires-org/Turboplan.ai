import Anthropic from "@anthropic-ai/sdk";

import type { FastModelClientOptions } from "../infra/model-provider";

export type FastModelClient = {
  complete(params: {
    system: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<string>;
};

export function createFastModelClient(
  model: string,
  options: FastModelClientOptions | null = null,
): FastModelClient {
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
    async complete({ system, prompt, maxTokens = 256 }) {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      });

      const block = response.content[0];
      if (!block || block.type !== "text") {
        throw new Error(
          `Unexpected response: ${block ? block.type : "empty content"}`,
        );
      }
      return block.text;
    },
  };
}
