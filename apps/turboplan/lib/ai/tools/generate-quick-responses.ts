import { generateObject, tool } from "ai";
import { z } from "zod";

import { ChatMode, getPrompt } from "@wildfires-org/turboplan-ai";
import { getModel } from "@wildfires-org/turboplan-ai/server";

import { type BillingContext, meterAiCall } from "@/lib/ai/metering";

/**
 * Keywords that trigger highlighting of quick responses.
 * When a response title contains these keywords, it will be highlighted
 * and auto-pasted into the input field after 500ms delay.
 */
const HIGHLIGHT_KEYWORDS = [
  "provide",
  "describe",
  "define",
  "share",
  "specify",
  "draft",
  "scoping",
  "assessment",
  "decision memo",
];

const quickResponseSchema = z.object({
  title: z.string().describe("Short button label (2-5 words)"),
  message: z
    .string()
    .describe(
      "Short direct answer (under 10 words) from the user's perspective. Must NOT be a question or explanation — just the answer.",
    ),
});

export interface QuickResponse {
  title: string;
  message: string;
  isHighlighted: boolean;
}

/**
 * Check if a quick response should be highlighted based on keywords in the title.
 * A response is highlighted if its title contains any of the HIGHLIGHT_KEYWORDS.
 */
function shouldHighlightQuickResponse(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  const titleWords = lowerTitle.split(/\s+/);

  return HIGHLIGHT_KEYWORDS.some(
    (keyword) =>
      titleWords.includes(keyword.toLowerCase()) ||
      lowerTitle === keyword.toLowerCase() ||
      lowerTitle.includes(keyword.toLowerCase()),
  );
}

export const generateQuickResponses = async (options?: {
  mode?: ChatMode;
  billing?: BillingContext | null;
}) => {
  const description = await getPrompt("tool-desc-generate-quick-responses");
  const isResearchMode = options?.mode === ChatMode.Research;

  return tool({
    description,
    inputSchema: z.object({
      conversationContext: z
        .string()
        .describe(
          "Brief summary of the current conversation context and what the user might want to do next",
        ),
    }),
    execute: async ({ conversationContext }) => {
      const documentGuidance = isResearchMode
        ? "- DO NOT suggest document creation, document drafting, or any document-related actions. Suggestions must be direct answers to the AI's clarifying question. Never suggest creating, drafting, or writing any documents."
        : "- When the context suggests document creation, focus on NEPA documents (Scoping Letters, Environmental Assessments, Decision Memos) — not tasks or milestones";

      const generation = await generateObject({
        model: await getModel("lite"),
        system: `Generate exactly 3 quick-tap answer bubbles for the user to respond to the AI's question.

All 3 must be plausible, distinct answers to the question — ranked from most likely to least likely based on context clues. No filler options like "Something else" or "Not sure" — every bubble should be a real answer the user might give.

Each response:
- Title: Start with a single relevant emoji, then 2-5 words (e.g., "🏛️ USFS Truckee District", "🌲 Categorical Exclusion")
- Message: The actual answer in under 10 words. Just the answer, no explanation or justification. Each bubble must be ONE single choice — NEVER combine options with "/" or "or" (e.g., "Categorical Exclusion" not "CE / Decision Memo"). If there are multiple options, put each in its own bubble.
${documentGuidance}
- MUST be pure statements — NEVER questions
- Each must be different`,
        prompt: `Context: ${conversationContext}

Generate 3 answer bubbles.`,
        output: "array",
        schema: quickResponseSchema,
      });
      const { object } = generation;

      await meterAiCall({
        billing: options?.billing,
        source: "suggestion",
        usage: generation.usage,
        providerMetadata: generation.providerMetadata,
        metadata: { tool: "generateQuickResponses" },
      });

      type QuickResponseInput = z.infer<typeof quickResponseSchema>;
      const quickResponses: QuickResponse[] = (object as QuickResponseInput[])
        .slice(0, 3)
        .map((response) => ({
          title: response.title,
          message: response.message,
          isHighlighted: shouldHighlightQuickResponse(response.title),
        }));

      return {
        quickResponses,
      };
    },
  });
};
