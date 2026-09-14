import { tool } from "ai";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";

import { exaSearch } from "@/lib/ai/exa-client";

export const webSearch = async () => {
  const description = await getPrompt("tool-desc-web-search");

  return tool({
    description,
    inputSchema: z.object({
      query: z.string().describe("The search query"),
      numResults: z
        .number()
        .int()
        .min(5)
        .max(10)
        .optional()
        .describe("Number of results to return (default 10, min 5)"),
      searchType: z
        .enum(["auto", "neural", "keyword"])
        .optional()
        .describe(
          "Search type: 'neural' for semantic/conceptual matching (best for finding similar projects), 'keyword' for exact term matching, 'auto' to let the engine decide. Default 'auto'.",
        ),
      category: z
        .string()
        .optional()
        .describe(
          "Category filter — use 'government' when searching for NEPA projects, agency documents, or federal/state sources",
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
      numResults,
      searchType,
      category,
      startPublishedDate,
      endPublishedDate,
    }) => {
      const response = await exaSearch(query, {
        numResults,
        searchType,
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
        publishedDate: result.publishedDate,
      }));

      return { results };
    },
  });
};
