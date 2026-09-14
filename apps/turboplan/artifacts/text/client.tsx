import { MoreHorizontal, Users } from "lucide-react";
import { toast } from "sonner";

import type { Suggestion } from "@wildfires-org/turboplan-db/types";
import { isSigningPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import { RequestSignaturesDialog } from "@wildfires-org/turboplan-signing/client";

import { ArtifactActionsMenu } from "@/components/artifact-actions-menu";
import { ExportDocumentMenu } from "@/components/artifact-export-menu";
import { Artifact } from "@/components/create-artifact";
import { DiffView } from "@/components/diffview";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { DownloadIcon, MessageIcon, PenIcon } from "@/components/icons";
import { useUser } from "@/components/providers/user-provider";
import { Editor } from "@/components/text-editor";
import { getSuggestions } from "../actions";

interface TextArtifactMetadata {
  suggestions: Array<Suggestion>;
  isRequestSignaturesOpen?: boolean;
}

export const textArtifact = new Artifact<"text", TextArtifactMetadata>({
  kind: "text",
  description: "Useful for text content, like drafting essays and emails.",
  initialize: async ({ documentId, setMetadata }) => {
    const suggestions = await getSuggestions({ documentId });

    setMetadata({
      suggestions,
    });
  },
  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    if (streamPart.type === "suggestion") {
      setMetadata((metadata) => {
        return {
          suggestions: [
            ...metadata.suggestions,
            streamPart.content as Suggestion,
          ],
        };
      });
    }

    if (streamPart.type === "text-delta") {
      setArtifact((draftArtifact) => {
        return {
          ...draftArtifact,
          content: draftArtifact.content + (streamPart.content as string),
          isVisible:
            draftArtifact.status === "streaming" &&
            draftArtifact.content.length > 400 &&
            draftArtifact.content.length < 450
              ? true
              : draftArtifact.isVisible,
          status: "streaming",
        };
      });
    }
  },
  content: ({
    mode,
    status,
    content,
    documentId,
    projectId,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
    metadata,
    setMetadata,
  }) => {
    // Rendered as a React component by artifact-panel, so hooks are safe here.
    const { user } = useUser();

    if (isLoading) {
      return <DocumentSkeleton />;
    }

    if (mode === "diff") {
      const oldContent = getDocumentContentById(currentVersionIndex - 1);
      const newContent = getDocumentContentById(currentVersionIndex);

      return <DiffView oldContent={oldContent} newContent={newContent} />;
    }

    return (
      <>
        <div className="flex w-full justify-center py-6 md:py-10 px-4 md:px-8">
          <div className="flex w-full max-w-4xl flex-row items-start">
            <div className="min-w-0 flex-1">
              <Editor
                content={content}
                suggestions={metadata ? metadata.suggestions : []}
                isCurrentVersion={isCurrentVersion}
                currentVersionIndex={currentVersionIndex}
                status={status}
                onSaveContent={onSaveContent}
              />
            </div>

            {metadata &&
            metadata.suggestions &&
            metadata.suggestions.length > 0 ? (
              <div className="md:hidden h-dvh w-12 shrink-0" />
            ) : null}
          </div>
        </div>

        {isSigningPackageEnabled() && projectId && (
          <RequestSignaturesDialog
            documentId={documentId}
            projectId={projectId}
            currentUserId={user?.id}
            open={metadata?.isRequestSignaturesOpen ?? false}
            onOpenChange={(open) => {
              setMetadata((m) => ({ ...m, isRequestSignaturesOpen: open }));
            }}
          />
        )}
      </>
    );
  },
  actions: [
    {
      icon: <MoreHorizontal size={18} />,
      description: "Document actions",
      render: (ctx) => (
        <ArtifactActionsMenu
          content={ctx.content}
          currentVersionIndex={ctx.currentVersionIndex}
          isCurrentVersion={ctx.isCurrentVersion}
          handleVersionChange={ctx.handleVersionChange}
          disabled={ctx.disabled}
        />
      ),
    },
    {
      icon: <DownloadIcon size={18} />,
      description: "Export / Save",
      render: (ctx) => (
        <ExportDocumentMenu
          content={ctx.content}
          title={ctx.title}
          projectId={ctx.projectId}
          disabled={ctx.disabled}
        />
      ),
    },
    ...(isSigningPackageEnabled()
      ? [
          {
            icon: <Users size={18} />,
            label: "Request signatures",
            description:
              "Sign this document or request signatures from members",
            onClick: ({
              setMetadata,
            }: {
              setMetadata: (
                fn: (m: TextArtifactMetadata) => TextArtifactMetadata,
              ) => void;
            }) => {
              setMetadata((m) => ({ ...m, isRequestSignaturesOpen: true }));
            },
            isDisabled: ({ isCurrentVersion }: { isCurrentVersion: boolean }) =>
              !isCurrentVersion,
          },
        ]
      : []),
  ],
  toolbar: [
    {
      icon: <PenIcon />,
      description: "Add final polish",
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: "user",
          content:
            "Please add final polish and check for grammar, add section titles for better structure, and ensure everything reads smoothly.",
        });
      },
    },
    {
      icon: <MessageIcon />,
      description: "Request suggestions",
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: "user",
          content:
            "Please add suggestions you have that could improve the writing.",
        });
      },
    },
  ],
});
