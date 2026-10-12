import type { UIMessage, UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import { Session } from "next-auth";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";
import {
  isMapPackageEnabled,
  isTasksPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { chooseDocumentLetterhead } from "@wildfires-org/turboplan-workspace/server";
import type { DocumentLetterhead } from "@wildfires-org/turboplan-workspace/types";

import { createChatTimer } from "@/lib/ai/chat-timing";
import { exaGetContents } from "@/lib/ai/exa-client";
import {
  MAX_REFERENCE_URLS,
  type ReferenceCache,
  resolveReferenceDocuments,
} from "@/lib/ai/reference-documents";
import { artifactKinds, documentHandlers } from "@/lib/artifacts/server";
import { generateUUID } from "@/lib/utils";

interface CreateDocumentProps {
  session: Session;
  writer: UIMessageStreamWriter;
  projectId?: string;
  chatId?: string;
  userMessage?: UIMessage;
  projectContext?: string;
  referenceCache: ReferenceCache;
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
  referenceCache,
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
      // Loose on purpose: a failed validation would throw away the whole
      // (slow to generate) input; the server drops invalid or extra URLs.
      referenceUrls: z
        .array(z.string())
        .optional()
        .describe(
          `URLs of reference documents to model this document on — at most ${MAX_REFERENCE_URLS}, normally the one analog-project document you read with getContents in this conversation. The server passes their full text to the document generator as structure, style and length guidance only. Never paste or summarize a reference's text in userContext — pass its URL here instead.`,
        ),
      userContext: z
        .string()
        .optional()
        .describe(
          "The document request for the generator — keep it COMPACT. The generator already receives the full project context (project fields, saved and unsaved research findings, tasks, saved documents list) and, via referenceUrls, the reference document's text, so never repeat either here. Include only: 'USER-CONFIRMED:' — facts the user explicitly stated or confirmed in THIS conversation that the project context does not already hold (quote or closely paraphrase the user's own words; one confirmed answer does not confirm anything else). 'UNCONFIRMED:' — other facts worth passing that the project context lacks: web-search findings, your own inferences. The generator flags UNCONFIRMED values for review — NEVER present them as confirmed project facts, and NEVER instruct the generator to copy a reference document's values (contacts, addresses, file codes, deadlines, citations, treatment lists); references supply structure and style only. A short 'LETTERHEAD LAYOUT' note: whose letterhead the document carries (its author/sender, never the recipient) and the reference header's layout in plain words (columns, left/center/right, bold lines, centered title block). Short format instructions (e.g. match the reference's length and structure).",
        ),
      // Loose on purpose, like referenceUrls: the server falls back to the
      // default letterhead for any id it does not recognize.
      letterheadId: z
        .string()
        .optional()
        .describe(
          'One id from the AVAILABLE LETTERHEADS section ("default", "none" or a letterhead id): the letterhead of the document\'s author/sender, never its recipient. Omit when that section is absent.',
        ),
    }),
    execute: async ({
      title,
      kind,
      userContext,
      referenceUrls,
      letterheadId,
    }) => {
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

      // Letterheads apply to project text documents only. Resolved (and a
      // non-default choice stored) before generation, so the generator's author
      // identity matches the letterhead the document renders with. Without a
      // choice (the org has no library letterheads) it stays undefined and the
      // handler resolves the default in parallel with its other loads, as before.
      let letterhead: DocumentLetterhead | null | undefined;
      if (kind === "text" && projectId && letterheadId !== undefined) {
        const logTiming = createChatTimer({ chatId, startedAt: Date.now() });
        const chosen = await chooseDocumentLetterhead({
          projectId,
          documentId: id,
          choice: letterheadId,
          userId: session.user?.id,
        });
        logTiming("letterhead-chosen", {
          requested: letterheadId ?? null,
          selection: chosen.selection,
        });
        letterhead = chosen.letterhead;
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
        loadReferenceDocuments: referenceUrls?.length
          ? () =>
              resolveReferenceDocuments({
                urls: referenceUrls,
                cache: referenceCache,
                fetchContents: exaGetContents,
              })
          : undefined,
        letterhead,
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
