import type { UIMessageStreamWriter } from "ai";
import { Session } from "next-auth";

import {
  saveDocument,
  updateDocumentVersionContent,
} from "@wildfires-org/turboplan-db/queries";
import type { Document } from "@wildfires-org/turboplan-db/types";
import {
  isMapPackageEnabled,
  isTasksPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { mapDocumentHandler } from "@wildfires-org/turboplan-map/server";
import { taskDocumentHandler } from "@wildfires-org/turboplan-tasks/artifact/server";

import { textDocumentHandler } from "@/artifacts/text/server";
import { ArtifactKind } from "@/components/artifact";
import { getErrorName } from "@/lib/ai/chat-timing";
import type { ReferenceDocument } from "@/lib/ai/reference-documents";
import { createDraftCheckpointer } from "@/lib/artifacts/draft-checkpoint";

// How often a streaming draft is saved, bounding what a cut-off run loses.
const DRAFT_CHECKPOINT_INTERVAL_MS = 5_000;

export interface SaveDocumentProps {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
  chatId?: string;
}

export interface CreateDocumentCallbackProps {
  id: string;
  title: string;
  userContext?: string;
  projectContext?: string;
  writer: UIMessageStreamWriter;
  session: Session;
  projectId?: string;
  chatId?: string;
  attachments?: Array<{ name?: string; contentType?: string; url: string }>;
  /** Reference documents the chat model passed by URL (text kind only). */
  loadReferenceDocuments?: () => Promise<ReferenceDocument[]>;
  /** Called with the full draft so far on every streamed delta. */
  onDraftProgress?: (content: string) => void;
}

export interface UpdateDocumentCallbackProps {
  document: Document;
  description: string;
  writer: UIMessageStreamWriter;
  session: Session;
}

export interface DocumentHandler<T = ArtifactKind> {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
}

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const userId = args.session?.user?.id;

      // A new document is one version row: the first save inserts it, later
      // checkpoints and the final save overwrite that same row.
      let versionCreatedAt: Date | undefined;
      const saveDraft = async (content: string) => {
        if (!userId) {
          return;
        }
        if (versionCreatedAt) {
          await updateDocumentVersionContent({
            id: args.id,
            createdAt: versionCreatedAt,
            content,
          });
          return;
        }
        const createdAt = new Date();
        await saveDocument({
          id: args.id,
          title: args.title,
          content,
          kind: config.kind,
          userId,
          chatId: args.chatId,
          createdAt,
        });
        versionCreatedAt = createdAt;
      };

      const checkpointer = createDraftCheckpointer({
        intervalMs: DRAFT_CHECKPOINT_INTERVAL_MS,
        save: saveDraft,
        onError: (error) => {
          console.error(
            "[Document] Draft checkpoint failed:",
            getErrorName(error),
          );
        },
      });

      const draftContent = await config.onCreateDocument({
        id: args.id,
        title: args.title,
        userContext: args.userContext,
        projectContext: args.projectContext,
        writer: args.writer,
        session: args.session,
        projectId: args.projectId,
        chatId: args.chatId,
        attachments: args.attachments,
        loadReferenceDocuments: args.loadReferenceDocuments,
        onDraftProgress: userId ? checkpointer.offer : undefined,
      });

      await checkpointer.settle();
      await saveDraft(draftContent);

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await config.onUpdateDocument({
        document: args.document,
        description: args.description,
        writer: args.writer,
        session: args.session,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          id: args.document.id,
          title: args.document.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
          chatId: args.document.chatId ?? undefined,
        });
      }

      return;
    },
  };
}

/*
 * Document handlers for each artifact kind.
 * Conditionally included based on feature flags.
 * Each handler resolves its own model lazily when needed.
 */
export const documentHandlers: Array<DocumentHandler> = [
  textDocumentHandler,
  ...(isTasksPackageEnabled()
    ? [createDocumentHandler(taskDocumentHandler)]
    : []),
  ...(isMapPackageEnabled() ? [createDocumentHandler(mapDocumentHandler)] : []),
];

// Define base artifact kinds
const baseArtifactKinds = ["text"] as const;

// Conditionally include tasks and map kinds
export const artifactKinds = [
  ...baseArtifactKinds,
  ...(isTasksPackageEnabled() ? (["tasks"] as const) : []),
  ...(isMapPackageEnabled() ? (["map"] as const) : []),
] as const;
