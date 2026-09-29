import type { UIMessage, UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import { Session } from "next-auth";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";
import {
  isMapPackageEnabled,
  isTasksPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";

import { artifactKinds, documentHandlers } from "@/lib/artifacts/server";
import { generateUUID } from "@/lib/utils";

interface CreateDocumentProps {
  session: Session;
  writer: UIMessageStreamWriter;
  projectId?: string;
  chatId?: string;
  userMessage?: UIMessage;
  projectContext?: string;
}

type DocumentAttachment = {
  url: string;
  name?: string;
  contentType?: string;
};

// Messages sent through the v6 `sendMessage` path carry files as `file` parts
// and leave the legacy `experimental_attachments` empty; accept both so
// document handlers (e.g. the map handler looking for ZIPs) see the files.
const getUserMessageAttachments = (
  userMessage?: UIMessage,
): Array<DocumentAttachment> => {
  if (!userMessage) {
    return [];
  }

  const legacyAttachments =
    (
      userMessage as UIMessage & {
        experimental_attachments?: Array<DocumentAttachment>;
      }
    ).experimental_attachments ?? [];

  const fileAttachments = (userMessage.parts ?? []).flatMap((part) =>
    part.type === "file"
      ? [{ url: part.url, name: part.filename, contentType: part.mediaType }]
      : [],
  );

  const seenUrls = new Set<string>();
  return [...legacyAttachments, ...fileAttachments].filter((attachment) => {
    if (seenUrls.has(attachment.url)) {
      return false;
    }
    seenUrls.add(attachment.url);
    return true;
  });
};

export const createDocument = async ({
  session,
  writer,
  projectId,
  chatId,
  userMessage,
  projectContext,
}: CreateDocumentProps) => {
  // Build description from parts based on feature flags
  const [descBase, descTasks, descMap, descFooter] = await Promise.all([
    getPrompt("tool-desc-create-document"),
    getPrompt("tool-desc-create-document-tasks"),
    getPrompt("tool-desc-create-document-map"),
    getPrompt("tool-desc-create-document-footer"),
  ]);

  let description = descBase;
  if (isTasksPackageEnabled()) {
    description += descTasks;
  }
  if (isMapPackageEnabled()) {
    description += descMap;
  }
  description += descFooter;

  // Filter out kinds based on feature flags
  let allowedKinds = [...artifactKinds];

  if (!isTasksPackageEnabled()) {
    allowedKinds = allowedKinds.filter((kind) => kind !== "tasks");
  }

  if (!isMapPackageEnabled()) {
    allowedKinds = allowedKinds.filter((kind) => kind !== "map");
  }

  return tool({
    description,
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(allowedKinds as [string, ...string[]]),
      userContext: z
        .string()
        .optional()
        .describe(
          "IMPORTANT: This is the primary way context reaches the document generator. Be thorough, and structure it into two labeled sections. 'USER-CONFIRMED:' — only facts the user explicitly stated or confirmed in THIS conversation (quote or closely paraphrase the user's own words; one confirmed answer does not confirm anything else). 'UNCONFIRMED:' — everything else worth passing along: research and web-search findings, values taken from reference documents, your own inferences. The generator flags UNCONFIRMED values for review, so include them freely — but NEVER present them as confirmed project facts, and NEVER instruct the generator to copy a reference document's values (contacts, addresses, file codes, deadlines, citations, treatment lists). Reference documents supply structure and style only.",
        ),
    }),
    execute: async ({ title, kind, userContext }) => {
      const id = generateUUID();

      writer.write({
        type: "data-artifact",
        transient: true,
        data: { type: "kind", content: kind },
      });

      writer.write({
        type: "data-artifact",
        transient: true,
        data: { type: "id", content: id },
      });

      writer.write({
        type: "data-artifact",
        transient: true,
        data: { type: "title", content: title },
      });

      writer.write({
        type: "data-artifact",
        transient: true,
        data: { type: "clear", content: "" },
      });

      if (userContext) {
        writer.write({
          type: "data-artifact",
          transient: true,
          data: { type: "debug-user-context", content: userContext },
        });
      }

      if (projectContext) {
        writer.write({
          type: "data-artifact",
          transient: true,
          data: { type: "debug-project-context", content: projectContext },
        });
      }

      const documentHandler = documentHandlers.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      await documentHandler.onCreateDocument({
        id,
        title,
        userContext,
        projectContext,
        writer,
        session,
        projectId,
        chatId,
        attachments: getUserMessageAttachments(userMessage),
      });

      writer.write({
        type: "data-artifact",
        transient: true,
        data: { type: "finish", content: "" },
      });

      return {
        id,
        title,
        kind,
        content: "A document was created and is now visible to the user.",
      };
    },
  });
};
