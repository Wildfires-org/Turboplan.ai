import type { UIMessageStreamWriter } from "ai";
import { Session } from "next-auth";

import { saveDocument } from "@wildfires-org/turboplan-db/queries";
import type { Document } from "@wildfires-org/turboplan-db/types";
import {
  isMapPackageEnabled,
  isTasksPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { mapDocumentHandler } from "@wildfires-org/turboplan-map/server";
import { taskDocumentHandler } from "@wildfires-org/turboplan-tasks/artifact/server";

import { textDocumentHandler } from "@/artifacts/text/server";
import { ArtifactKind } from "@/components/artifact";

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
      });

      if (args.session?.user?.id) {
        await saveDocument({
          id: args.id,
          title: args.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
          chatId: args.chatId,
        });
      }

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
