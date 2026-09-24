"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import type { UIMessage } from "ai";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";

import type { Attachment } from "@wildfires-org/turboplan-chat-actions/types";
import { DEFAULT_SUGGESTION_TEMPLATES } from "@wildfires-org/turboplan-research-agent-integration/types";
import { SuggestionPills } from "@wildfires-org/turboplan-utils";

import {
  initialArtifactData,
  useArtifact,
  useArtifactSelector,
} from "@/hooks/use-artifact";
import { useChatCompat } from "@/hooks/use-chat-compat";
import { getSidebarChatsKey } from "@/hooks/use-sidebar-chats";
import { getChatHistoryPaginationKey } from "@/lib/chat-history";
import { AppUrls } from "@/lib/nav/urls";
import { generateUUID } from "@/lib/utils";
import { Artifact, type ArtifactKind, artifactDefinitions } from "../artifact";
import type { ArtifactStreamDelta } from "../data-stream-handler";
import { Messages } from "../messages";
import { CHAT_COMPOSER_SHELL_CLASS, CHAT_FORM_CLASS } from "./chat-classes";
import { ProjectMultimodalInput } from "./project-multimodal-input";

type ProjectChatProps = {
  id: string;
  initialMessages: Array<UIMessage>;
  isReadonly: boolean;
  projectId?: string;
  onChatCreated?: (chatId: string) => void;
  isInitialChat?: boolean;
  isInputDisabled?: boolean;
  disabledPlaceholder?: string;
  isResearchPhaseCompleted?: boolean;
  projectName?: string;
  researchSuggestions?: Array<{ label: string; content: string }>;
};

export type ProjectChatRef = {
  injectMessage: (message: UIMessage) => void;
};

export const ProjectChat = forwardRef<ProjectChatRef, ProjectChatProps>(
  function ProjectChat(
    {
      id,
      initialMessages,
      isReadonly,
      projectId,
      onChatCreated,
      isInputDisabled,
      disabledPlaceholder,
      isResearchPhaseCompleted,
      projectName,
      researchSuggestions,
    },
    ref,
  ) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { mutate } = useSWRConfig();
    const sidebarChatsKey = getSidebarChatsKey(projectId ?? null);

    const { artifact, setArtifact, setMetadata } = useArtifact();

    const handleArtifactDelta = useCallback(
      (delta: ArtifactStreamDelta) => {
        const artifactDefinition = artifactDefinitions.find(
          (def) => def.kind === artifact.kind,
        );

        if (artifactDefinition?.onStreamPart) {
          const onStreamPart = artifactDefinition.onStreamPart as (args: {
            streamPart: ArtifactStreamDelta;
            setArtifact: typeof setArtifact;
            setMetadata: typeof setMetadata;
          }) => void;
          onStreamPart({
            streamPart: delta,
            setArtifact,
            setMetadata,
          });
        }

        setArtifact((draftArtifact) => {
          if (!draftArtifact) {
            return { ...initialArtifactData, status: "streaming" };
          }

          switch (delta.type) {
            case "id":
              return {
                ...draftArtifact,
                documentId: delta.content as string,
                status: "streaming",
              };

            case "title":
              return {
                ...draftArtifact,
                title: delta.content as string,
                status: "streaming",
              };

            case "kind":
              return {
                ...draftArtifact,
                kind: delta.content as ArtifactKind,
                status: "streaming",
              };

            case "clear":
              return {
                ...draftArtifact,
                content: "",
                status: "streaming",
              };

            case "finish":
              return {
                ...draftArtifact,
                status: "idle",
              };

            case "debug-user-context":
            case "debug-project-context": {
              const key = `doc-debug-${draftArtifact.documentId}`;
              try {
                const existing = JSON.parse(localStorage.getItem(key) ?? "{}");
                if (delta.type === "debug-user-context") {
                  existing.userContext = delta.content;
                } else {
                  existing.projectContext = delta.content;
                }
                localStorage.setItem(key, JSON.stringify(existing));
              } catch {
                // noop
              }
              return draftArtifact;
            }

            default:
              return draftArtifact;
          }
        });
      },
      [artifact.kind, setArtifact, setMetadata],
    );

    const {
      messages,
      setMessages,
      handleSubmit,
      input,
      setInput,
      append,
      status,
      stop,
      reload,
    } = useChatCompat({
      id,
      body: { id, projectId },
      initialMessages,
      generateId: generateUUID,
      onFinish: () => {
        mutate(unstable_serialize(getChatHistoryPaginationKey));

        // Re-fetch project chat list to get real title after streaming
        if (sidebarChatsKey) {
          mutate(sidebarChatsKey);
        }
      },
      onError: (error) => {
        // Silently ignore duplicate request rejections (see inFlightChats in route.ts)
        if (error.message === "Already processing") {
          return;
        }
        // The chat route returns 402 CREDITS_EXHAUSTED before opening a
        // stream; the SDK surfaces the JSON body as the error message.
        if (error.message.includes("CREDITS_EXHAUSTED")) {
          const orgSlug = window.location.pathname.match(
            /\/organizations\/([^/]+)/,
          )?.[1];
          toast.error("Monthly credits used up", {
            description:
              "This organization has used its monthly AI credits. Upgrade the plan to keep going.",
            action: orgSlug
              ? {
                  label: "Upgrade",
                  onClick: () => {
                    window.location.href = AppUrls.organizationBilling(orgSlug);
                  },
                }
              : undefined,
          });
          return;
        }
        toast.error("An error occured, please try again!", {
          description: error.message,
        });
      },
      onArtifactDelta: handleArtifactDelta,
    });

    useImperativeHandle(
      ref,
      () => ({
        injectMessage: (message: UIMessage) => {
          setMessages((prev) => [...prev, message]);
        },
      }),
      [setMessages],
    );

    const [attachments, setAttachments] = useState<Array<Attachment>>([]);
    const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

    const documentSuggestions = useMemo(() => {
      if (researchSuggestions && researchSuggestions.length > 0) {
        return researchSuggestions;
      }
      const name = projectName || "this project";
      return DEFAULT_SUGGESTION_TEMPLATES.map((t) => ({
        label: t.label,
        content: t.contentTemplate.replace("{projectName}", name),
        emoji: t.emoji,
      }));
    }, [researchSuggestions, projectName]);

    const suggestions = useMemo(() => {
      if (!isResearchPhaseCompleted) {
        return [];
      }
      const sentContents = new Set<string>();
      for (const msg of messages) {
        if (msg.role !== "user") {
          continue;
        }
        const text = msg.parts?.find((p) => p.type === "text")?.text?.trim();
        if (text) {
          sentContents.add(text);
        }
      }
      return documentSuggestions.filter((s) => !sentContents.has(s.content));
    }, [isResearchPhaseCompleted, messages, documentSuggestions]);

    const handleSuggestionClick = useCallback(
      (content: string) => {
        setInput(content);
      },
      [setInput],
    );

    // Fire onChatCreated exactly once, when streaming starts (server confirmed chat exists)
    const hasNotifiedChatCreated = useRef(false);
    const notifyChatCreated = useCallback(() => {
      if (
        !hasNotifiedChatCreated.current &&
        initialMessages.length === 0 &&
        onChatCreated
      ) {
        hasNotifiedChatCreated.current = true;
        onChatCreated(id);
        if (sidebarChatsKey) {
          mutate(sidebarChatsKey);
        }
      }
    }, [initialMessages.length, onChatCreated, id, sidebarChatsKey, mutate]);

    // Swap URL and update sidebar as soon as streaming starts
    useEffect(() => {
      if (status === "streaming") {
        notifyChatCreated();
      }
    }, [status, notifyChatCreated]);

    // Auto-send initial message from URL parameter
    // Empty deps array is intentional - this should only run on mount when URL param is present
    // Ref guard prevents React StrictMode double-mount from calling append() twice
    const hasAutoSent = useRef(false);
    useEffect(() => {
      if (hasAutoSent.current) {
        return;
      }

      const initialMessageContent = searchParams.get("initialMessageContent");
      const prefillContent = searchParams.get("prefillContent");

      if (!initialMessageContent && !prefillContent) return;

      // Use replaceState instead of router.replace to avoid Next.js navigation
      // that would conflict with the URL swap when streaming starts
      const currentParams = new URLSearchParams(searchParams.toString());
      currentParams.delete("initialMessageContent");
      currentParams.delete("prefillContent");
      const cleanUrl = currentParams.toString()
        ? `${pathname}?${currentParams.toString()}`
        : pathname;
      window.history.replaceState(null, "", cleanUrl);

      if (initialMessageContent && initialMessages.length === 0) {
        hasAutoSent.current = true;
        append({
          role: "user",
          content: initialMessageContent,
        });
      } else if (prefillContent) {
        setInput(prefillContent);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <>
        <div className="flex h-full min-w-0 flex-col">
          <Messages
            chatId={id}
            status={status}
            messages={messages}
            setMessages={setMessages}
            reload={reload}
            isReadonly={isReadonly}
            isArtifactVisible={isArtifactVisible}
            append={append}
            setInput={setInput}
            projectId={projectId}
          />

          <form className={CHAT_FORM_CLASS}>
            {!isReadonly && (
              <div className={CHAT_COMPOSER_SHELL_CLASS}>
                <ProjectMultimodalInput
                  chatId={id}
                  projectId={projectId}
                  input={input}
                  setInput={setInput}
                  handleSubmit={handleSubmit}
                  status={status}
                  stop={stop}
                  attachments={attachments}
                  setAttachments={setAttachments}
                  messages={messages}
                  setMessages={setMessages}
                  append={append}
                  isInputDisabled={isInputDisabled}
                  disabledPlaceholder={disabledPlaceholder}
                />
              </div>
            )}

            {isResearchPhaseCompleted &&
              !isReadonly &&
              suggestions.length > 0 && (
                <SuggestionPills
                  suggestions={suggestions}
                  onSuggestionClick={handleSuggestionClick}
                />
              )}
          </form>
        </div>

        <Artifact
          chatId={id}
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          status={status}
          stop={stop}
          attachments={attachments}
          setAttachments={setAttachments}
          append={append}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          projectId={projectId}
        />
      </>
    );
  },
);
