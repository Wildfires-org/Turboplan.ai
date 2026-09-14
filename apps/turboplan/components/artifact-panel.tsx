"use client";

import React, {
  createElement,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";

import type { UIMessage } from "ai";
import { formatDistance } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import useSWR, { useSWRConfig } from "swr";
import { useDebounceCallback, useWindowSize } from "usehooks-ts";

import type { Attachment } from "@wildfires-org/turboplan-chat-actions/types";
import type { Document } from "@wildfires-org/turboplan-db/types";

import { useResearchPanel } from "@/contexts/research-panel-context";
import { initialArtifactData, useArtifact } from "@/hooks/use-artifact";
import type { ChatHelpers } from "@/hooks/use-chat-compat";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { useSidebarPinnedState } from "@/hooks/use-sidebar-pinned-state";
import { fetcher } from "@/lib/utils";
import { artifactDefinitions, type UIArtifact } from "./artifact";
import { ArtifactActions } from "./artifact-actions";
import { ArtifactCloseButton } from "./artifact-close-button";
import { ArtifactMessages } from "./artifact-messages";
import { Artifact as ArtifactClass } from "./create-artifact";
import { DocumentPromptDebug } from "./document-prompt-debug";
import { MultimodalInput } from "./multimodal-input";
import { Toolbar } from "./toolbar";
import { VersionFooter } from "./version-footer";

export interface ArtifactPanelProps {
  chatId: string;
  input: string;
  setInput: ChatHelpers["setInput"];
  handleSubmit: ChatHelpers["handleSubmit"];
  status: ChatHelpers["status"];
  stop: ChatHelpers["stop"];
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  append: ChatHelpers["append"];
  messages: Array<UIMessage>;
  setMessages: ChatHelpers["setMessages"];
  reload: ChatHelpers["reload"];
  isReadonly: boolean;
  projectId?: string;
}

const DASHBOARD_HEADER_HEIGHT = 64;
const DESKTOP_SIDEBAR_WIDTH = 300;
const DESKTOP_SIDEBAR_ICON_WIDTH = 68;

function useArtifactViewportLayout({
  boundingBox,
  isSidebarPinned,
}: {
  boundingBox: UIArtifact["boundingBox"];
  isSidebarPinned: boolean;
}) {
  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const viewportWidth = windowWidth ?? 0;
  const viewportHeight = windowHeight ?? 0;
  const isMobile = windowWidth ? windowWidth < 768 : false;
  const desktopSidebarOffset = isMobile
    ? 0
    : isSidebarPinned
      ? DESKTOP_SIDEBAR_WIDTH
      : DESKTOP_SIDEBAR_ICON_WIDTH;
  const desktopTopOffset = isMobile ? 0 : DASHBOARD_HEADER_HEIGHT;
  const availableWidth = Math.max(viewportWidth - desktopSidebarOffset, 0);
  const availableHeight = Math.max(viewportHeight - desktopTopOffset, 0);
  const initialDesktopX = Math.max(boundingBox.left - desktopSidebarOffset, 0);
  const initialDesktopY = Math.max(boundingBox.top - desktopTopOffset, 0);

  return {
    viewportWidth,
    viewportHeight,
    isMobile,
    desktopSidebarOffset,
    desktopTopOffset,
    availableWidth,
    availableHeight,
    initialDesktopX,
    initialDesktopY,
  };
}

export function ArtifactPanel({
  chatId,
  input,
  setInput,
  handleSubmit,
  status,
  stop,
  attachments,
  setAttachments,
  append,
  messages,
  setMessages,
  reload,
  isReadonly,
  projectId,
}: ArtifactPanelProps) {
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact();
  const { isOpen: isResearchPanelOpen, width: researchPanelWidth } =
    useResearchPanel();
  const { width: chatRailWidth, handleResizeStart: handleChatRailResizeStart } =
    useResizablePanel({
      storageKey: "artifact-chat-rail-width",
      defaultWidth: 400,
      minWidth: 320,
      maxWidth: 600,
      direction: "right",
    });

  const {
    data: documents,
    isLoading: isDocumentsFetching,
    mutate: mutateDocuments,
  } = useSWR<Array<Document>>(
    artifact.documentId !== "init" && artifact.status !== "streaming"
      ? `/api/document?id=${artifact.documentId}`
      : null,
    fetcher,
  );

  const [mode, setMode] = useState<"edit" | "diff">("edit");
  const [document, setDocument] = useState<Document | null>(null);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const isSidebarPinned = useSidebarPinnedState();

  useEffect(() => {
    if (documents && documents.length > 0) {
      const mostRecentDocument = documents.at(-1);

      if (mostRecentDocument) {
        setDocument(mostRecentDocument);
        setCurrentVersionIndex(documents.length - 1);
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          content: mostRecentDocument.content ?? "",
        }));
      }
    }
  }, [documents, setArtifact]);

  useEffect(() => {
    mutateDocuments();
  }, [artifact.status, mutateDocuments]);

  useEffect(() => {
    if (!artifact.isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setArtifact((currentArtifact) =>
          currentArtifact.status === "streaming"
            ? { ...currentArtifact, isVisible: false }
            : { ...initialArtifactData, status: "idle" },
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [artifact.isVisible, setArtifact]);

  const { mutate } = useSWRConfig();
  const [isContentDirty, setIsContentDirty] = useState(false);

  const handleContentChange = useCallback(
    (updatedContent: string) => {
      if (!artifact) return;

      mutate<Array<Document>>(
        `/api/document?id=${artifact.documentId}`,
        async (currentDocuments) => {
          if (!currentDocuments) return undefined;

          const currentDocument = currentDocuments.at(-1);

          if (!currentDocument || !currentDocument.content) {
            setIsContentDirty(false);
            return currentDocuments;
          }

          if (currentDocument.content !== updatedContent) {
            await fetch(`/api/document?id=${artifact.documentId}`, {
              method: "POST",
              body: JSON.stringify({
                title: artifact.title,
                content: updatedContent,
                kind: artifact.kind,
              }),
            });

            setIsContentDirty(false);

            const newDocument = {
              ...currentDocument,
              content: updatedContent,
              createdAt: new Date(),
            };

            return [...currentDocuments, newDocument];
          }
          return currentDocuments;
        },
        { revalidate: false },
      );
    },
    [artifact, mutate],
  );

  const debouncedHandleContentChange = useDebounceCallback(
    handleContentChange,
    2000,
  );

  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      if (document && updatedContent !== document.content) {
        setIsContentDirty(true);

        if (debounce) {
          debouncedHandleContentChange(updatedContent);
        } else {
          handleContentChange(updatedContent);
        }
      }
    },
    [document, debouncedHandleContentChange, handleContentChange],
  );

  function getDocumentContentById(index: number) {
    if (!documents) return "";
    if (!documents[index]) return "";
    return documents[index].content ?? "";
  }

  const handleVersionChange = (type: "next" | "prev" | "toggle" | "latest") => {
    if (!documents) return;

    if (type === "latest") {
      setCurrentVersionIndex(documents.length - 1);
      setMode("edit");
    }

    if (type === "toggle") {
      setMode((currentMode) => (currentMode === "edit" ? "diff" : "edit"));
    }

    if (type === "prev") {
      if (currentVersionIndex > 0) {
        setCurrentVersionIndex((index) => index - 1);
      }
    } else if (type === "next") {
      if (currentVersionIndex < documents.length - 1) {
        setCurrentVersionIndex((index) => index + 1);
      }
    }
  };

  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  const isCurrentVersion =
    documents && documents.length > 0
      ? currentVersionIndex === documents.length - 1
      : true;

  const {
    viewportWidth,
    viewportHeight,
    isMobile,
    desktopSidebarOffset,
    desktopTopOffset,
    availableWidth,
    availableHeight,
    initialDesktopX,
    initialDesktopY,
  } = useArtifactViewportLayout({
    boundingBox: artifact.boundingBox,
    isSidebarPinned,
  });
  const artifactControlsOffset =
    !isMobile && isResearchPanelOpen ? researchPanelWidth : 0;

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );

  if (!artifactDefinition) {
    throw new Error("Artifact definition not found!");
  }

  useEffect(() => {
    if (artifact.documentId !== "init") {
      if (artifactDefinition.initialize) {
        artifactDefinition.initialize({
          documentId: artifact.documentId,
          setMetadata,
        });
      }
    }
  }, [artifact.documentId, artifactDefinition, setMetadata]);

  return (
    <AnimatePresence>
      {artifact.isVisible && (
        <motion.div
          data-testid="artifact"
          className={`fixed z-[60] flex bg-transparent ${
            isMobile ? "flex-col" : "flex-row"
          }`}
          style={{
            top: desktopTopOffset,
            left: desktopSidebarOffset,
            height: isMobile ? "100dvh" : availableHeight,
          }}
          initial={{ opacity: 1 }}
          animate={{
            opacity: 1,
            width: isMobile
              ? "100dvw"
              : availableWidth - artifactControlsOffset,
          }}
          transition={{
            width: {
              duration: 0.5,
              ease: [0.32, 0.72, 0, 1],
            },
          }}
          exit={{ opacity: 0, transition: { delay: 0.4 } }}
        >
          {!isMobile && (
            <motion.div
              className="pointer-events-none absolute inset-0 bg-background"
              initial={{
                width: availableWidth,
              }}
              animate={{ width: availableWidth }}
              exit={{
                width: availableWidth,
              }}
            />
          )}

          {!isMobile && (
            <motion.div
              className="relative z-20 shrink-0"
              style={{ width: chatRailWidth }}
              initial={{ opacity: 0, x: 10, scale: 1 }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
                transition: {
                  delay: 0.2,
                  type: "spring",
                  stiffness: 200,
                  damping: 30,
                },
              }}
              exit={{
                opacity: 0,
                x: 0,
                scale: 1,
                transition: { duration: 0 },
              }}
            >
              <AnimatePresence>
                {!isCurrentVersion && (
                  <motion.div
                    className="absolute inset-0 z-50 bg-zinc-900/50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              <div className="flex size-full flex-col items-center justify-between gap-4 overflow-hidden">
                <ArtifactMessages
                  chatId={chatId}
                  status={status}
                  messages={messages}
                  setMessages={setMessages}
                  reload={reload}
                  isReadonly={isReadonly}
                  artifactStatus={artifact.status}
                  append={append}
                  setInput={setInput}
                />

                <form className="relative flex w-full flex-row items-end gap-2 px-4 pb-4">
                  <MultimodalInput
                    chatId={chatId}
                    input={input}
                    setInput={setInput}
                    handleSubmit={handleSubmit}
                    status={status}
                    stop={stop}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    messages={messages}
                    append={append}
                    className="bg-background dark:bg-muted"
                    setMessages={setMessages}
                  />
                </form>
              </div>

              {/* Resize handle */}
              <div
                onMouseDown={handleChatRailResizeStart}
                className="absolute right-0 inset-y-0 w-1 cursor-col-resize z-50 hover:bg-ring transition-colors"
              />
            </motion.div>
          )}

          <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
            <motion.div
              className="flex min-h-0 w-full flex-1 flex-col overflow-y-scroll dark:bg-muted bg-background md:border-l dark:border-zinc-700 border-zinc-200 pt-24"
              initial={
                isMobile
                  ? {
                      opacity: 1,
                      x: artifact.boundingBox.left,
                      y: artifact.boundingBox.top,
                      height: artifact.boundingBox.height,
                      width: artifact.boundingBox.width,
                      borderRadius: 50,
                    }
                  : {
                      opacity: 1,
                      x: initialDesktopX,
                      y: initialDesktopY,
                      height: artifact.boundingBox.height,
                      width: artifact.boundingBox.width,
                      borderRadius: 50,
                    }
              }
              animate={
                isMobile
                  ? {
                      opacity: 1,
                      x: 0,
                      y: 0,
                      height: viewportHeight,
                      width: viewportWidth || "calc(100dvw)",
                      borderRadius: 0,
                      transition: {
                        delay: 0,
                        type: "spring",
                        stiffness: 200,
                        damping: 30,
                        duration: 5000,
                      },
                    }
                  : {
                      opacity: 1,
                      x: 0,
                      y: 0,
                      height: availableHeight,
                      width: "100%",
                      borderRadius: 0,
                      transition: {
                        delay: 0,
                        type: "spring",
                        stiffness: 200,
                        damping: 30,
                        duration: 5000,
                      },
                    }
              }
              exit={{
                opacity: 0,
                scale: 0.5,
                transition: {
                  delay: 0.1,
                  type: "spring",
                  stiffness: 600,
                  damping: 30,
                },
              }}
            >
              <div className="relative z-20 bg-background pt-2 pl-4 pb-4 flex flex-row justify-between items-start pr-9 border-b">
                <div className="flex flex-row gap-4 items-start">
                  <ArtifactCloseButton />

                  <div className="flex flex-col">
                    <div className="font-medium">{artifact.title}</div>

                    {isContentDirty ? (
                      <div className="text-sm text-muted-foreground">
                        Saving changes...
                      </div>
                    ) : document ? (
                      <div className="text-sm text-muted-foreground">
                        {`Updated ${formatDistance(
                          new Date(document.createdAt),
                          new Date(),
                          {
                            addSuffix: true,
                          },
                        )}`}
                      </div>
                    ) : (
                      <div className="w-32 h-3 mt-2 bg-muted-foreground/20 rounded-md animate-pulse" />
                    )}
                  </div>
                </div>

                <div className="flex flex-row gap-2 items-center">
                  <DocumentPromptDebug
                    kind={artifact.kind}
                    documentId={artifact.documentId}
                  />
                  <ArtifactActions
                    artifact={artifact}
                    currentVersionIndex={currentVersionIndex}
                    handleVersionChange={handleVersionChange}
                    isCurrentVersion={isCurrentVersion}
                    mode={mode}
                    metadata={metadata}
                    setMetadata={setMetadata}
                    projectId={projectId}
                  />
                </div>
              </div>

              <div className="dark:bg-muted bg-background h-full overflow-y-scroll !max-w-full items-center">
                {createElement(
                  artifactDefinition.content as unknown as React.ComponentType<
                    Record<string, unknown>
                  >,
                  {
                    title: artifact.title,
                    content: isCurrentVersion
                      ? artifact.content
                      : getDocumentContentById(currentVersionIndex),
                    documentId: artifact.documentId,
                    mode,
                    status: artifact.status,
                    currentVersionIndex,
                    suggestions: [],
                    onSaveContent: saveContent,
                    isInline: false,
                    isCurrentVersion,
                    getDocumentContentById,
                    isLoading: isDocumentsFetching && !artifact.content,
                    metadata,
                    setMetadata,
                    projectId,
                  },
                )}

                <AnimatePresence>
                  {isCurrentVersion && (
                    <Toolbar
                      isToolbarVisible={isToolbarVisible}
                      setIsToolbarVisible={setIsToolbarVisible}
                      append={append}
                      status={status}
                      stop={stop}
                      setMessages={setMessages}
                      artifactKind={artifact.kind}
                    />
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {!isCurrentVersion && (
                  <VersionFooter
                    currentVersionIndex={currentVersionIndex}
                    documents={documents}
                    handleVersionChange={handleVersionChange}
                    artifactDefinition={
                      artifactDefinition as ArtifactClass<string, unknown>
                    }
                    metadata={metadata}
                    setMetadata={setMetadata}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
