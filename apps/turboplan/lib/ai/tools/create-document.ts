import type { UIMessage, UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import { Session } from "next-auth";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";
import {
  isMapPackageEnabled,
  isTasksPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import {
  chooseDocumentLetterhead,
  copyReferenceLetterhead,
  type ReferenceLetterheadCopy,
} from "@wildfires-org/turboplan-workspace/server";
import type { DocumentLetterhead } from "@wildfires-org/turboplan-workspace/types";

import { createChatTimer } from "@/lib/ai/chat-timing";
import { exaGetContents } from "@/lib/ai/exa-client";
import {
  MAX_REFERENCE_URLS,
  type ReferenceCache,
} from "@/lib/ai/reference-documents";
import {
  createReferenceLoader,
  letterheadReferences,
  loadSavedReferences,
  reportSavedReferences,
  type SavedReferences,
} from "@/lib/ai/saved-references";
import { artifactKinds, documentHandlers } from "@/lib/artifacts/server";
import { generateUUID } from "@/lib/utils";

interface CreateDocumentProps {
  session: Session;
  writer: UIMessageStreamWriter;
  projectId?: string;
  /**
   * The organization readOrganizationDocuments is bound to (resolved
   * server-side after a READ check); its documents may be references
   */
  organizationId?: string;
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

/**
 * A reference letterhead the document does not carry, with what to tell the
 * user. Worded here rather than in the (seeded) tool description, which only
 * explains `letterheadFrom`.
 */
type ReferenceLetterheadNote = {
  filename: string;
  reason: "letterhead-pending" | "letterhead-offered";
  note: string;
};

const referenceLetterheadNotes = (
  copy: ReferenceLetterheadCopy | null,
  isLibraryChoice: boolean,
): ReferenceLetterheadNote[] => {
  if (!copy) {
    return [];
  }
  const notes = copy.pendingFilenames.map(
    (filename): ReferenceLetterheadNote => ({
      filename,
      reason: "letterhead-pending",
      note: `The letterhead of "${filename}" is still being read, so this document does not carry it. In one short sentence, tell the user so and that they can ask again in a minute to apply it. A reference's letterhead is applied only when a document is created: if they ask, call createDocument again with the same reference.`,
    }),
  );
  // Without a library letterhead the model named, a copy is left unselected
  // only for a research document: another project's sender.
  const { copied } = copy;
  if (copied && !copied.selected && !isLibraryChoice) {
    const filename = copied.referenceFilename;
    notes.push({
      filename,
      reason: "letterhead-offered",
      note: `"${filename}" is another project's document, so its letterhead was NOT applied to this document. Never say the document carries this file's letterhead. In one short sentence, tell the user it is available in the document's Letterhead menu as "From ${filename}" if they want it.`,
    });
  }
  return notes;
};

export const createDocument = async ({
  session,
  writer,
  projectId,
  organizationId,
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
          `URLs of reference documents to model this document on — at most ${MAX_REFERENCE_URLS}, normally the one analog-project document you read with getContents in this conversation. The server passes their full text to the document generator as structure, style and length guidance only. Never paste or summarize a reference's text in userContext — pass its URL here instead. A saved project or organization document goes in referenceDocumentIds instead.`,
        ),
      // Loose like referenceUrls: unknown or foreign ids are dropped.
      referenceDocumentIds: z
        .array(z.string())
        .optional()
        .describe(
          `IDs of saved project documents (Saved Project Documents list) or organization documents ("[id: …]" in the organization context) to model this document on — at most ${MAX_REFERENCE_URLS} references in total with referenceUrls. The server passes their stored text to the generator like referenceUrls; never call getContents on their URL.`,
        ),
      userContext: z
        .string()
        .optional()
        .describe(
          "The document request for the generator — keep it COMPACT. The generator already receives the full project context (project fields, saved and unsaved research findings, tasks, saved documents list) and, via referenceUrls or referenceDocumentIds, the reference document's text, so never repeat either here. Include only: 'USER-CONFIRMED:' — facts the user explicitly stated or confirmed in THIS conversation that the project context does not already hold (quote or closely paraphrase the user's own words; one confirmed answer does not confirm anything else). 'UNCONFIRMED:' — other facts worth passing that the project context lacks: web-search findings, your own inferences. The generator flags UNCONFIRMED values for review — NEVER present them as confirmed project facts, and NEVER instruct the generator to copy a reference document's values (contacts, addresses, file codes, deadlines, citations, treatment lists); references supply structure and style only. A short 'LETTERHEAD LAYOUT' note: whose letterhead the document carries (its author/sender, never the recipient) and the reference header's layout in plain words (columns, left/center/right, bold lines, centered title block). Short format instructions (e.g. match the reference's length and structure).",
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
      referenceDocumentIds,
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

      // Only the text handler reads references, so no other kind looks them
      // up or gets a loader — which also keeps every kind's storage URLs away
      // from Exa. Saved project/organization documents named as references
      // (by id or storage URL) are read from the database instead of Exa.
      const loadReferences = async (): Promise<SavedReferences | undefined> => {
        if (
          kind !== "text" ||
          !(referenceDocumentIds?.length || referenceUrls?.length)
        ) {
          return undefined;
        }
        const logTiming = createChatTimer({ chatId, startedAt: Date.now() });
        const saved = await loadSavedReferences({
          projectId,
          organizationId,
          userId: session.user?.id,
          documentIds: referenceDocumentIds,
          urls: referenceUrls,
        });
        logTiming("references-loaded", {
          requestedIds: referenceDocumentIds?.length ?? 0,
          requestedUrls: referenceUrls?.length ?? 0,
          savedCount: saved.references.length,
          savedTextCount: saved.references.filter(({ text }) => text).length,
          webUrlCount: saved.webUrls.length,
          unresolvedCount: saved.unresolved,
        });
        return saved;
      };

      // Letterheads apply to project text documents only. Resolved (and a
      // non-default choice stored) before generation, so the generator's author
      // identity matches the letterhead the document renders with. Without a
      // choice (the org has no library letterheads) it stays undefined and the
      // handler resolves the default in parallel with its other loads, as before.
      const chooseLetterhead = async () => {
        if (kind !== "text" || !projectId || letterheadId === undefined) {
          return undefined;
        }
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
        return chosen;
      };

      // A document modeled on saved references gets a copy of the first
      // analyzed reference's letterhead, stored for it (DB only) and selected
      // unless a library letterhead the model named wins or the reference is
      // a research document (another project's: only offered). Runs after
      // both the lookup, which it needs, and the model's choice: its
      // selection then overwrites a "none" the model chose.
      const copyLetterhead = async (
        loaded: SavedReferences | undefined,
        select: boolean,
      ): Promise<ReferenceLetterheadCopy | null> => {
        if (kind !== "text" || !projectId || !loaded) {
          return null;
        }
        const references = letterheadReferences(loaded).map(
          ({ kind: referenceKind, id: referenceId, source }) => ({
            kind: referenceKind,
            id: referenceId,
            ...(source ? { source } : {}),
          }),
        );
        if (references.length === 0) {
          return null;
        }
        const logTiming = createChatTimer({ chatId, startedAt: Date.now() });
        const result = await copyReferenceLetterhead({
          projectId,
          organizationId,
          documentId: id,
          references,
          userId: session.user?.id,
          select,
        });
        logTiming("letterhead-copied", {
          copied: result.copied !== null,
          select,
          selected: result.copied?.selected ?? false,
          pendingCount: result.pendingFilenames.length,
        });
        return result;
      };

      const [saved, chosen] = await Promise.all([
        loadReferences(),
        chooseLetterhead(),
      ]);
      // Order: a library letterhead the model named (honored: it belongs to
      // the organization) → the reference copy → the model's "default" /
      // "none", or the handler's default. Under a library letterhead the copy
      // is still stored, unselected, so the Letterhead menu offers it.
      const isLibraryChoice =
        chosen !== undefined &&
        chosen.selection !== "default" &&
        chosen.selection !== "none";
      const copy = await copyLetterhead(saved, !isLibraryChoice);
      // An unselected copy (under a library letterhead, or a research
      // document's) is only offered in the Letterhead menu.
      const carriedCopy = copy?.copied?.selected ? copy.copied : null;
      const letterhead: DocumentLetterhead | null | undefined = carriedCopy
        ? carriedCopy.letterhead
        : chosen?.letterhead;

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
        loadReferenceDocuments: saved
          ? createReferenceLoader({
              saved,
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

      const references = saved ? reportSavedReferences(saved) : undefined;
      const letterheadNotes = referenceLetterheadNotes(copy, isLibraryChoice);
      return {
        id,
        title,
        kind,
        content: "A document was created and is now visible to the user.",
        ...(references ? { references } : {}),
        // The reference whose letterhead the document carries.
        ...(carriedCopy
          ? { letterheadFrom: carriedCopy.referenceFilename }
          : {}),
        ...(letterheadNotes.length > 0 ? { letterheadNotes } : {}),
      };
    },
  });
};
