import { tool } from "ai";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";

export const researchNotes = async () => {
  const description = await getPrompt("tool-desc-research-notes");

  return tool({
    description,
    inputSchema: z.object({
      title: z
        .string()
        .describe(
          "Short title for this research note (3-6 words, e.g., 'Comparable Project Analysis')",
        ),
      content: z
        .string()
        .describe(
          "Plain text research notes, analysis, or reasoning — no markdown formatting",
        ),
    }),
    execute: async ({ content }) => {
      return { content };
    },
  });
};
