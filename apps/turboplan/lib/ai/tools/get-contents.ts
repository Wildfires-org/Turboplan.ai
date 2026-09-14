import { tool } from "ai";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";

import { exaGetContents } from "@/lib/ai/exa-client";

export const getContents = async () => {
  const description = await getPrompt("tool-desc-get-contents");

  return tool({
    description,
    inputSchema: z.object({
      urls: z
        .array(z.string().url())
        .min(1)
        .max(5)
        .describe("URLs to read (max 5)"),
      maxCharacters: z
        .number()
        .int()
        .min(500)
        .max(10000)
        .optional()
        .describe(
          "Request full sequential text content per URL (up to 10000 chars). Only pass this when you need to deep-read a document. By default, only highlights and summaries are returned.",
        ),
    }),
    execute: async ({ urls, maxCharacters }) => {
      const response = await exaGetContents(urls, maxCharacters);

      if (response.warning) {
        return { results: [], warning: response.warning };
      }

      const results = response.results.map((result) => ({
        url: result.url,
        title: result.title,
        ...(result.text && { content: result.text }),
        ...(result.highlights && { highlights: result.highlights }),
        ...(result.summary && { summary: result.summary }),
      }));

      return { results };
    },
  });
};
