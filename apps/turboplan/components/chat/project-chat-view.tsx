"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef } from "react";

import type { UIMessage } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";

import type { Attachment } from "@wildfires-org/turboplan-chat-actions/types";
import type {
  Chat,
  DBMessage,
  Project,
} from "@wildfires-org/turboplan-db/types";
import { isResearchAgentPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import {
  ResearchPanel,
  ResearchPanelHeader,
  type SaveDetails,
  useResearchAgentMessages,
  useResearchAgentStatus,
  useResearchPhase,
} from "@wildfires-org/turboplan-research-agent-integration/client";
import {
  type ContextMessageData,
  type DocumentsMessageData,
  type FieldsMessageData,
  type MilestonesMessageData,
  ResearchAgentMessageType,
  type SuggestionsMessageData,
} from "@wildfires-org/turboplan-research-agent-integration/types";
import { Button } from "@wildfires-org/turboplan-utils";

import {
  ProjectChat,
  type ProjectChatRef,
} from "@/components/chat/project-chat";
import { useNewChat } from "@/contexts/new-chat-context";
import {
  ResearchPanelProvider,
  useResearchPanel,
} from "@/contexts/research-panel-context";
import { getSidebarChatsKey } from "@/hooks/use-sidebar-chats";
import { EMPTY_STATE_TEXT_CLASS, EMPTY_STATE_TITLE_CLASS } from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import { RESEARCH_SAVED_TYPE } from "@/lib/research-saved-annotation";
import { cn, fetcher, generateUUID } from "@/lib/utils";
import {
  CHAT_COMPOSER_SHELL_CLASS,
  CHAT_FORM_CLASS,
  RESEARCH_PANE_CLASS,
} from "./chat-classes";
import { ProjectChatHeader } from "./project-chat-header";
import { ChatMessagesSkeleton } from "./project-chat-page-shell";
import { ProjectSetupBanner } from "./project-setup-banner";

interface ProjectChatViewProps {
  project: Project;
  chat: Chat | null;
  isInitialChat: boolean;
  userId: string;
}

export const ProjectChatView = ({
  project,
  chat,
  isInitialChat,
  userId,
}: ProjectChatViewProps) => {
  return (
    <ResearchPanelProvider
      defaultOpen={
        isResearchAgentPackageEnabled() &&
        (chat?.isInitial ?? isInitialChat) &&
        !project.isResearchPhaseCompleted
      }
    >
      <ProjectChatViewInner
        project={project}
        chat={chat}
        isInitialChat={isInitialChat}
        userId={userId}
      />
    </ResearchPanelProvider>
  );
};

const ProjectChatViewInner = ({
  project,
  chat,
  isInitialChat,
  userId,
}: ProjectChatViewProps) => {
  const HEADER_MIN_HEIGHT_CLASS = 72;
  const chatRef = useRef<ProjectChatRef>(null);

  const { mutate } = useSWRConfig();
  const { newChatKey } = useNewChat();
  const params = useParams<{
    orgSlug: string;
    officeSlug: string;
    projectSlug: string;
  }>();
  // Generate a stable ID for new chats, regenerated when newChatKey changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const generatedId = useMemo(() => generateUUID(), [newChatKey]);
  const chatId = chat?.id ?? generatedId;
  const sidebarChatsKey = getSidebarChatsKey(project.id);

  // Fetch messages when a chat is provided
  const {
    data: dbMessages = [],
    error: messagesError,
    isLoading: isLoadingMessages,
    mutate: mutateMessages,
  } = useSWR<Array<DBMessage>>(
    chat ? `/api/chat/${chat.id}/messages` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  // Convert DB messages to UI messages
  const uiMessages = useMemo(() => {
    return dbMessages.map((message) => ({
      id: message.id,
      parts: message.parts as UIMessage["parts"],
      role: message.role as UIMessage["role"],
      content: "",
      createdAt: message.createdAt,
      experimental_attachments:
        (message.attachments as Array<Attachment>) ?? [],
    }));
  }, [dbMessages]);

  // Subscribe to the chats SWR cache so the header title updates
  // after the AI-generated title is fetched
  const { data: cachedChats } = useSWR<Array<Chat>>(sidebarChatsKey, null, {
    revalidateOnFocus: false,
    revalidateOnMount: false,
  });

  const effectiveIsInitialChat = chat?.isInitial ?? isInitialChat;

  const {
    isOpen: isResearchPanelOpen,
    width: researchPanelWidth,
    isDragging,
    toggle: toggleResearchPanel,
    setOpen: setResearchPanelOpen,
    handleResizeStart,
  } = useResearchPanel();

  const researchEnabled = isResearchAgentPackageEnabled();
  const { hasPermission: canEditResearch } = useEntityPermission({
    userId,
    entityType: EntityType.PROJECT,
    entityId: project.id,
    action: Action.UPDATE,
  });
  const { status: researchAgentStatus, isActive: researchAgentIsActive } =
    useResearchAgentStatus(
      researchEnabled && effectiveIsInitialChat ? project.id : null,
    );
  const {
    isResearchPhaseCompleted,
    completeResearchPhase,
    isCompleting: isCompletingResearch,
  } = useResearchPhase(
    researchEnabled && effectiveIsInitialChat ? project.id : null,
  );
  const { messages: researchAgentAllMessages } = useResearchAgentMessages(
    researchEnabled && effectiveIsInitialChat ? project.id : null,
    researchAgentIsActive,
  );
  const progressMessages = researchAgentAllMessages.filter(
    (m) => m.type === ResearchAgentMessageType.PROGRESS,
  );

  const hasResearchContent = useMemo(
    () =>
      researchAgentAllMessages.some(
        (m) => m.type !== ResearchAgentMessageType.PROGRESS,
      ),
    [researchAgentAllMessages],
  );
  const isResearchDataReady =
    researchAgentStatus?.status === "completed" ||
    researchAgentStatus?.currentStep === "Finishing up..." ||
    (!researchAgentIsActive && hasResearchContent);

  const hasSavedResearchItems = useMemo(() => {
    return researchAgentAllMessages.some((msg) => {
      switch (msg.type) {
        case ResearchAgentMessageType.DOCUMENTS: {
          const data = msg.data as DocumentsMessageData;
          return data.documents.some((d) => d.saved);
        }
        case ResearchAgentMessageType.MILESTONES: {
          const data = msg.data as MilestonesMessageData;
          return data.milestones.some(
            (m) => m.saved || m.tasks.some((t) => t.saved),
          );
        }
        case ResearchAgentMessageType.FIELDS: {
          const data = msg.data as FieldsMessageData;
          return data.fields.some((f) => f.saved);
        }
        case ResearchAgentMessageType.CONTEXT: {
          const data = msg.data as ContextMessageData;
          return data.context.some((c) => c.saved);
        }
        default:
          return false;
      }
    });
  }, [researchAgentAllMessages]);

  const researchSuggestions = useMemo(() => {
    const suggestionsMsg = researchAgentAllMessages.find(
      (m) => m.type === ResearchAgentMessageType.SUGGESTIONS,
    );
    if (!suggestionsMsg) {
      return undefined;
    }
    const data = suggestionsMsg.data as SuggestionsMessageData;
    return data.suggestions;
  }, [researchAgentAllMessages]);

  const handleResearchItemsSaved = useCallback(
    (details: SaveDetails) => {
      const messageId = generateUUID();
      const syntheticMessage = {
        id: messageId,
        role: "assistant" as const,
        parts: [
          {
            type: `data-research-saved` as const,
            data: {
              type: RESEARCH_SAVED_TYPE,
              totalSaved: details.totalSaved,
              sections: details.sections,
            },
          },
        ],
      } as UIMessage;
      chatRef.current?.injectMessage(syntheticMessage);

      // Persist the card so it survives a page refresh. Only chats that already
      // exist in the DB can receive messages; the initial unsaved chat keeps the
      // injected-only behavior.
      if (!chat?.id) {
        return;
      }
      void fetch(`/api/chat/${chat.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: messageId,
          totalSaved: details.totalSaved,
          sections: details.sections,
        }),
      }).then((response) => {
        if (response.ok) {
          void mutateMessages();
        }
      });
    },
    [chat?.id, mutateMessages],
  );

  useEffect(() => {
    setResearchPanelOpen(false);
  }, [newChatKey, setResearchPanelOpen]);

  // Auto-open the research panel while the research phase is in progress
  useEffect(() => {
    if (effectiveIsInitialChat && !project.isResearchPhaseCompleted) {
      setResearchPanelOpen(true);
    }
  }, [
    effectiveIsInitialChat,
    project.isResearchPhaseCompleted,
    setResearchPanelOpen,
  ]);

  // Update URL and sidebar immediately when first message is sent
  const handleChatCreated = useCallback(
    (newChatId: string) => {
      const newUrl = AppUrls.projectChatById(
        params.orgSlug,
        params.officeSlug,
        params.projectSlug,
        newChatId,
      );
      window.history.replaceState(null, "", newUrl);

      // Optimistically inject the new chat into the sidebar SWR cache
      mutate(
        sidebarChatsKey,
        (currentChats: Array<Chat> | undefined) => {
          const newChat: Chat = {
            id: newChatId,
            title: "New Chat",
            userId,
            projectId: project.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            visibility: "private",
            isInitial: effectiveIsInitialChat,
          };
          return [newChat, ...(currentChats ?? [])];
        },
        { revalidate: false },
      );
    },
    [
      params,
      mutate,
      project.id,
      sidebarChatsKey,
      userId,
      effectiveIsInitialChat,
    ],
  );

  // Derive the display chat: prefer prop, then SWR cache, then fallback
  const cachedChat = cachedChats?.find((c) => c.id === chatId);
  const displayChat = useMemo(() => {
    return (
      chat ??
      cachedChat ?? {
        id: chatId,
        title: "New Chat",
        userId,
        projectId: project.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        visibility: "private" as const,
        isInitial: effectiveIsInitialChat,
      }
    );
  }, [chat, cachedChat, chatId, userId, project.id, effectiveIsInitialChat]);

  return (
    <div
      className="flex h-full"
      style={
        {
          "--header-min-height": `${HEADER_MIN_HEIGHT_CLASS}px`,
        } as React.CSSProperties
      }
    >
      <div className="flex-1 flex min-w-0 min-h-0">
        <div className="flex flex-1 min-w-0 min-h-0">
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="shrink-0">
              <ProjectChatHeader
                selectedChat={displayChat}
                isResearchPanelOpen={
                  effectiveIsInitialChat ? isResearchPanelOpen : undefined
                }
                onToggleResearchPanel={
                  effectiveIsInitialChat ? toggleResearchPanel : undefined
                }
                researchAgentStatus={
                  effectiveIsInitialChat ? researchAgentStatus : undefined
                }
              />
            </div>

            {effectiveIsInitialChat &&
              researchEnabled &&
              !isResearchPhaseCompleted && (
                <ProjectSetupBanner
                  isResearchAgentCompleted={isResearchDataReady}
                  hasSavedItems={hasSavedResearchItems}
                  onCompleteResearch={completeResearchPhase}
                  isCompleting={isCompletingResearch}
                />
              )}

            <div
              className="flex-1 min-h-0"
              style={{
                maskImage:
                  "linear-gradient(to bottom, transparent, black 48px)",
              }}
            >
              {isLoadingMessages ? (
                <div className="flex h-full flex-col">
                  <span className="sr-only" role="status">
                    Loading messages...
                  </span>
                  <ChatMessagesSkeleton />
                  {/* Composer placeholder keeps the list height stable. */}
                  <div className={CHAT_FORM_CLASS}>
                    <div
                      className={cn(CHAT_COMPOSER_SHELL_CLASS, "h-[59px]")}
                    />
                  </div>
                </div>
              ) : messagesError ? (
                <div className="flex h-full items-center justify-center px-4">
                  <div className="glass-card flex max-w-sm flex-col items-center gap-3 rounded-[20px] px-6 py-6 text-center">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-error-50 text-error-700">
                      <AlertCircle aria-hidden className="size-5" />
                    </span>
                    <div>
                      <p className={EMPTY_STATE_TITLE_CLASS}>
                        Couldn&apos;t load messages
                      </p>
                      <p className={cn(EMPTY_STATE_TEXT_CLASS, "mt-1")}>
                        {messagesError.message}
                      </p>
                    </div>
                    <div>
                      <Button
                        size="sm"
                        variant="brand"
                        onClick={() => mutateMessages()}
                        disabled={isLoadingMessages}
                      >
                        {isLoadingMessages ? (
                          <>
                            <Loader2 className="size-3 animate-spin mr-1" />
                            Retrying...
                          </>
                        ) : (
                          "Try Again"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Fragment key={chatId}>
                  <ProjectChat
                    ref={chatRef}
                    id={chatId}
                    initialMessages={uiMessages}
                    isReadonly={false}
                    projectId={project.id}
                    onChatCreated={chat ? undefined : handleChatCreated}
                    isInitialChat={effectiveIsInitialChat}
                    isResearchPhaseCompleted={
                      effectiveIsInitialChat
                        ? isResearchPhaseCompleted
                        : undefined
                    }
                    projectName={project.name}
                    researchSuggestions={
                      effectiveIsInitialChat ? researchSuggestions : undefined
                    }
                  />
                </Fragment>
              )}
            </div>
          </div>

          {effectiveIsInitialChat && researchEnabled && (
            // initial={false}: a pane that is open on first render (research
            // in progress) is already laid out by the loading state.
            <AnimatePresence initial={false}>
              {isResearchPanelOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: researchPanelWidth, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={
                    isDragging
                      ? { duration: 0 }
                      : { duration: 0.5, ease: [0.32, 0.72, 0, 1] }
                  }
                  className={RESEARCH_PANE_CLASS}
                >
                  {/* Resize handle */}
                  <div
                    onMouseDown={handleResizeStart}
                    className="absolute inset-y-0 left-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-brand-700/30"
                  />

                  <div
                    className="relative flex flex-col flex-1 min-h-0"
                    style={{ width: researchPanelWidth }}
                  >
                    <div className="absolute inset-x-0 top-0 z-10 min-h-[var(--header-min-height)] border-b border-slate-900/[0.06] bg-white/70 py-4 pl-3 pr-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
                      <ResearchPanelHeader
                        status={researchAgentStatus}
                        progressMessages={progressMessages}
                        onClose={() => setResearchPanelOpen(false)}
                        hideStatus
                      />
                    </div>

                    <div className="flex-1 min-h-0 pt-[var(--header-min-height)]">
                      <ResearchPanel
                        isOpen={isResearchPanelOpen}
                        projectId={project.id}
                        projectName={project.name}
                        isResearchCompleted={isResearchDataReady}
                        onComplete={() => setResearchPanelOpen(false)}
                        onItemsSaved={handleResearchItemsSaved}
                        canEdit={canEditResearch}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};
