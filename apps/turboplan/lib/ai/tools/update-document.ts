import type { UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import { Session } from "next-auth";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";
import { getDocumentById } from "@wildfires-org/turboplan-db/queries";

import { documentHandlers } from "@/lib/artifacts/server";

interface UpdateDocumentProps {
  session: Session;
  writer: UIMessageStreamWriter;
}

export const updateDocument = async ({
  session,
  writer,
}: UpdateDocumentProps) => {
  const description = await getPrompt("tool-desc-update-document");

  return tool({
    description,
    inputSchema: z.object({
      id: z.string().describe("The ID of the document to update"),
      description: z
        .string()
        .describe("The description of changes that need to be made"),
    }),
    execute: async ({ id, description }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: "Document not found",
        };
      }

      writer.write({
        type: "data-artifact",
        data: { type: "clear", content: document.title },
      });

      const documentHandler = documentHandlers.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler.onUpdateDocument({
        document,
        description,
        writer,
        session,
      });

      writer.write({
        type: "data-artifact",
        data: { type: "finish", content: "" },
      });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: "The document has been updated successfully.",
      };
    },
  });
};
