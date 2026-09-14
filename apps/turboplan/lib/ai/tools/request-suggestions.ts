import type { UIMessageStreamWriter } from "ai";
import { streamObject, tool } from "ai";
import { Session } from "next-auth";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";
import { getModel } from "@wildfires-org/turboplan-ai/server";
import {
  getDocumentById,
  saveSuggestions,
} from "@wildfires-org/turboplan-db/queries";
import type { Suggestion } from "@wildfires-org/turboplan-db/types";

import { type BillingContext, meterAiCall } from "@/lib/ai/metering";
import { generateUUID } from "@/lib/utils";

interface RequestSuggestionsProps {
  session: Session;
  writer: UIMessageStreamWriter;
  billing?: BillingContext | null;
}

export const requestSuggestions = async ({
  session,
  writer,
  billing,
}: RequestSuggestionsProps) => {
  const description = await getPrompt("tool-desc-request-suggestions");

  return tool({
    description,
    inputSchema: z.object({
      documentId: z
        .string()
        .describe("The ID of the document to request edits"),
    }),
    execute: async ({ documentId }) => {
      const document = await getDocumentById({ id: documentId });

      if (!document || !document.content) {
        return {
          error: "Document not found",
        };
      }

      const suggestions: Array<
        Omit<Suggestion, "userId" | "createdAt" | "documentCreatedAt">
      > = [];

      const suggestionSchema = z.object({
        originalSentence: z.string().describe("The original sentence"),
        suggestedSentence: z.string().describe("The suggested sentence"),
        description: z.string().describe("The description of the suggestion"),
      });
      type SuggestionElement = z.infer<typeof suggestionSchema>;
      const suggestionStream = streamObject({
        model: await getModel("lite"),
        system:
          "You are a help writing assistant. Given a piece of writing, please offer suggestions to improve the piece of writing and describe the change. It is very important for the edits to contain full sentences instead of just words. Max 5 suggestions.",
        prompt: document.content,
        output: "array",
        schema: suggestionSchema,
      });

      for await (const element of suggestionStream.elementStream as AsyncIterable<SuggestionElement>) {
        const suggestion = {
          originalText: element.originalSentence,
          suggestedText: element.suggestedSentence,
          description: element.description,
          id: generateUUID(),
          documentId: documentId,
          isResolved: false,
        };

        writer.write({
          type: "data-artifact",
          data: { type: "suggestion", content: suggestion },
        });

        suggestions.push(suggestion);
      }

      await meterAiCall({
        billing,
        source: "suggestion",
        usage: await suggestionStream.usage,
        providerMetadata: await suggestionStream.providerMetadata,
        metadata: { tool: "requestSuggestions", documentId },
      });

      if (session.user?.id) {
        const userId = session.user.id;

        await saveSuggestions({
          suggestions: suggestions.map((suggestion) => ({
            ...suggestion,
            userId,
            createdAt: new Date(),
            documentCreatedAt: document.createdAt,
          })),
        });
      }

      return {
        id: documentId,
        title: document.title,
        kind: document.kind,
        message: "Suggestions have been added to the document",
      };
    },
  });
};
