import { MoreHorizontal, Stamp, TextCursorInput, Users } from "lucide-react";
import { toast } from "sonner";

import type { Suggestion } from "@wildfires-org/turboplan-db/types";
import { isSigningPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import { RequestSignaturesDialog } from "@wildfires-org/turboplan-signing/client";
import { contentHasLetterheadTable } from "@wildfires-org/turboplan-workspace/types";

import { ArtifactActionsMenu } from "@/components/artifact-actions-menu";
import { ExportDocumentMenu } from "@/components/artifact-export-menu";
import { Artifact } from "@/components/create-artifact";
import { DiffView } from "@/components/diffview";
import { DocumentLetterheadPicker } from "@/components/document-letterhead-picker";
import { DocumentPlaceholdersButton } from "@/components/document-placeholders-button";
import { DocumentPlaceholdersPanel } from "@/components/document-placeholders-panel";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { DownloadIcon, MessageIcon, PenIcon } from "@/components/icons";
import { LetterheadBand } from "@/components/letterhead-band";
import { LetterheadLogo } from "@/components/letterhead-logo";
import { useUser } from "@/components/providers/user-provider";
import { Editor } from "@/components/text-editor";
import { useDocumentLetterhead } from "@/hooks/use-document-letterhead";
import { useLetterheadLogo } from "@/hooks/use-letterhead-logo";
import { getSuggestions } from "../actions";

interface TextArtifactMetadata {
  suggestions: Array<Suggestion>;
  isRequestSignaturesOpen?: boolean;
  isPlaceholdersOpen?: boolean;
}

// Streamed characters after which the artifact panel opens by itself.
const AUTO_OPEN_CONTENT_LENGTH = 400;

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
        const content = draftArtifact.content + (streamPart.content as string);
        // Open once, on the delta that crosses the threshold. A fixed window
        // could be skipped by one long delta (a table row, a URL).
        const hasCrossedAutoOpenThreshold =
          draftArtifact.content.length <= AUTO_OPEN_CONTENT_LENGTH &&
          content.length > AUTO_OPEN_CONTENT_LENGTH;

        return {
          ...draftArtifact,
          content,
          isVisible:
            draftArtifact.status === "streaming" && hasCrossedAutoOpenThreshold
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
    // "init" is the placeholder id before the document is persisted.
    const savedDocumentId = documentId !== "init" ? documentId : null;
    const letterheadLogo = useLetterheadLogo(projectId, savedDocumentId);
    const documentLetterhead = useDocumentLetterhead(
      projectId,
      savedDocumentId,
    );
    const hasOwnLetterheadTable = contentHasLetterheadTable(content);
    const chosenLetterhead = documentLetterhead?.letterhead ?? null;
    const isBanner = chosenLetterhead?.layout === "banner";
    // The document's chosen letterhead (default, library or none) replaces an
    // AI-written one, unless the document already carries its own letterhead
    // table (older documents). A banner is only its image (no markdown), shown
    // once loaded.
    const structuredLetterhead =
      chosenLetterhead &&
      (isBanner ? !!letterheadLogo : !!documentLetterhead?.markdown) &&
      !hasOwnLetterheadTable
        ? chosenLetterhead
        : null;

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
            <div className="relative min-w-0 flex-1">
              {structuredLetterhead ? (
                <div className="prose dark:prose-invert mx-auto">
                  <LetterheadBand
                    letterhead={structuredLetterhead}
                    logoSrc={letterheadLogo}
                  />
                </div>
              ) : (
                // A banner image never doubles as a margin logo.
                letterheadLogo &&
                !isBanner && <LetterheadLogo src={letterheadLogo} />
              )}
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

        <DocumentPlaceholdersPanel
          open={isCurrentVersion && (metadata?.isPlaceholdersOpen ?? false)}
          onOpenChange={(open) => {
            setMetadata((m) => ({ ...m, isPlaceholdersOpen: open }));
          }}
          content={content}
          projectId={projectId}
          onSaveContent={onSaveContent}
        />

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
      icon: <TextCursorInput size={18} />,
      description: "Fill placeholders",
      render: (ctx) =>
        ctx.isCurrentVersion ? (
          <DocumentPlaceholdersButton
            content={ctx.content}
            disabled={ctx.disabled}
            onOpen={() =>
              ctx.setMetadata((m) => ({ ...m, isPlaceholdersOpen: true }))
            }
          />
        ) : null,
    },
    {
      icon: <Stamp size={18} />,
      description: "Letterhead",
      render: (ctx) =>
        ctx.projectId && ctx.documentId && ctx.documentId !== "init" ? (
          <DocumentLetterheadPicker
            projectId={ctx.projectId}
            documentId={ctx.documentId}
            hasOwnLetterheadTable={contentHasLetterheadTable(ctx.content)}
            disabled={ctx.disabled || !ctx.isCurrentVersion}
          />
        ) : null,
    },
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
          documentId={ctx.documentId}
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
