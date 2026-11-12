import { tool } from "ai";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";

import {
  firecrawlSearch,
  WEB_SEARCH_CATEGORIES,
} from "@/lib/ai/firecrawl-client";

export const webSearch = async () => {
  const description = await getPrompt("tool-desc-web-search");

  return tool({
    description,
    inputSchema: z.object({
      query: z.string().describe("The search query"),
      category: z
        .enum(WEB_SEARCH_CATEGORIES)
        .optional()
        .describe(
          "Narrow the search: 'government' for US government (.gov) sites — agency documents, NEPA projects, federal/state sources; 'pdf' for PDF documents such as decision memos and environmental assessments; 'research' for academic and scientific papers",
        ),
      startPublishedDate: z
        .string()
        .optional()
        .describe("Filter results published after this date (YYYY-MM-DD)"),
      endPublishedDate: z
        .string()
        .optional()
        .describe("Filter results published before this date (YYYY-MM-DD)"),
    }),
    execute: async ({
      query,
      category,
      startPublishedDate,
      endPublishedDate,
    }) => {
      const response = await firecrawlSearch(query, {
        category,
        startPublishedDate,
        endPublishedDate,
      });

      if (response.warning) {
        return { results: [], warning: response.warning };
      }

      const results = response.results.map((result) => ({
        title: result.title,
        url: result.url,
        highlights: result.highlights ?? [],
      }));

      return { results };
    },
  });
};
