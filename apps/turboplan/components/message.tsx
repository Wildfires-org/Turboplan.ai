"use client";

import { useState } from "react";

import type { UIMessage } from "ai";
import { motion } from "framer-motion";

import type { Attachment } from "@wildfires-org/turboplan-chat-actions/types";
import {
  DocumentPreviewDialog,
  getPreviewDocumentMimeType,
} from "@wildfires-org/turboplan-documents/client";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@wildfires-org/turboplan-utils";

import type { ChatHelpers } from "@/hooks/use-chat-compat";
import { useStreamingDots } from "@/hooks/use-streaming-dots";
import { cn } from "@/lib/utils";
import { ToolInvocationState } from "@/types/ToolInvocationState";
import { Tools } from "@/types/Tools";
import {
  CHAT_MESSAGE_ROW_CLASS,
  USER_BUBBLE_SHELL_CLASS,
} from "./chat/chat-classes";
import { ThinkingDots } from "./chat/thinking-dots";
import { PencilEditIcon, SparklesIcon } from "./icons";
import { Markdown } from "./markdown";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { ResearchStep, type ResearchToolName } from "./research-step";
import { Tool } from "./tools";

const RESEARCH_TOOLS = new Set<string>([
  Tools.webSearch,
  Tools.getContents,
  Tools.researchNotes,
]);

// Derive a human-readable filename from an R2 URL for older persisted file
// parts that lack an explicit `filename`. Strips the timestamp prefix that R2
// pathnames carry (e.g. "1783082125458-scoping-letter.docx").
const deriveFilenameFromUrl = (url: string): string => {
  const lastSegment = url.split("/").at(-1) ?? "";
  let decoded = lastSegment;
  try {
    decoded = decodeURIComponent(lastSegment);
  } catch {
    // Keep the raw segment if it isn't valid percent-encoding.
  }
  // Storage keys are `{timestamp}-{uuid}-{name}`; older keys omit the uuid.
  const withoutPrefix = decoded.replace(
    /^\d+-(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-)?/i,
    "",
  );
  return withoutPrefix || "Document";
};

const PurePreviewMessage = ({
  message,
  isLoading,
  setMessages,
  reload,
  isReadonly,
  isLastMessage,
  setInput,
  status,
}: {
  message: UIMessage;
  isLoading: boolean;
  setMessages: ChatHelpers["setMessages"];
  reload: ChatHelpers["reload"];
  isReadonly: boolean;
  isLastMessage: boolean;
  setInput: ChatHelpers["setInput"];
  status: ChatHelpers["status"];
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(
    null,
  );
  const showStreamingDots = useStreamingDots(isLoading, message);

  return (
    <>
      <div
        data-testid={`message-${message.role}`}
        className={cn(CHAT_MESSAGE_ROW_CLASS, "group/message")}
        data-role={message.role}
      >
        <div
          className={cn(
            "flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl",
            {
              "w-full": mode === "edit",
              "group-data-[role=user]/message:w-fit": mode !== "edit",
            },
          )}
        >
          {message.role === "assistant" && <AssistantAvatar />}

          <div className="flex flex-col gap-4 w-full min-w-0">
            {/* Get attachments from legacy field (v4) or file parts (v6) */}
            {(() => {
              const legacyAttachments =
                (
                  message as UIMessage & {
                    experimental_attachments?: Attachment[];
                  }
                ).experimental_attachments ?? [];
              const filePartAttachments: Attachment[] = (message.parts ?? [])
                .filter(
                  (
                    p,
                  ): p is {
                    type: "file";
                    url: string;
                    mediaType: string;
                    filename?: string;
                  } =>
                    p.type === "file" &&
                    "url" in p &&
                    typeof (p as Record<string, unknown>).url === "string",
                )
                .map((p) => ({
                  url: p.url,
                  contentType: p.mediaType,
                  // Images render as thumbnails and stay caption-less; documents
                  // show their filename. Route both the explicit `filename`
                  // (which for freshly-sent docs is the raw R2 upload pathname)
                  // and the URL fallback through the deriver so captions/tooltips
                  // never leak the storage path or user id.
                  name: p.mediaType.startsWith("image")
                    ? undefined
                    : deriveFilenameFromUrl(p.filename ?? p.url),
                }));
              const attachments = [
                ...legacyAttachments,
                ...filePartAttachments,
              ];
              if (attachments.length === 0) {
                return null;
              }
              return (
                <div
                  data-testid="message-attachments"
                  className="flex flex-row justify-end gap-2"
                >
                  {attachments.map((attachment) => {
                    const previewMimeType = getPreviewDocumentMimeType({
                      mimeType: attachment.contentType,
                      filename: attachment.name,
                      url: attachment.url,
                    });

                    return (
                      <PreviewAttachment
                        key={attachment.url}
                        attachment={attachment}
                        onClick={
                          previewMimeType
                            ? () => setPreviewAttachment(attachment)
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              );
            })()}

            {message.parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === "reasoning") {
                return (
                  <MessageReasoning
                    key={key}
                    id={key}
                    isLoading={isLoading}
                    reasoning={part.text}
                  />
                );
              }

              if (type === "text") {
                if (mode === "view") {
                  return (
                    <div
                      key={key}
                      className="flex flex-row gap-2 items-start"
                      data-message-part
                    >
                      {message.role === "user" && !isReadonly && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              data-testid="message-edit-button"
                              variant="ghost"
                              aria-label="Edit message"
                              className="h-fit rounded-full px-2 text-gray-550 opacity-0 hover:bg-white/70 hover:text-foreground focus-visible:opacity-100 group-hover/message:opacity-100"
                              onClick={() => {
                                setMode("edit");
                              }}
                            >
                              <PencilEditIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit message</TooltipContent>
                        </Tooltip>
                      )}

                      <div
                        data-testid="message-content"
                        className={cn(
                          "chat-prose flex min-w-0 flex-col gap-4",
                          message.role === "user" &&
                            cn(USER_BUBBLE_SHELL_CLASS, "px-3.5 py-2.5"),
                        )}
                      >
                        <Markdown>{part.text}</Markdown>
                      </div>
                    </div>
                  );
                }

                if (mode === "edit") {
                  return (
                    <div
                      key={key}
                      className="flex flex-row gap-2 items-start"
                      data-message-part
                    >
                      <div className="size-8" />

                      <MessageEditor
                        key={message.id}
                        message={message}
                        setMode={setMode}
                        setMessages={setMessages}
                        reload={reload}
                      />
                    </div>
                  );
                }
              }

              if (type.startsWith("tool-")) {
                const toolName = type.slice(5);
                const { toolCallId, state } = part as {
                  toolCallId: string;
                  state: string;
                  input?: unknown;
                  output?: unknown;
                };
                const toolInput = (part as { input?: unknown }).input as
                  | Record<string, unknown>
                  | undefined;
                const toolOutput = (part as { output?: unknown }).output as
                  | Record<string, unknown>
                  | undefined;

                if (RESEARCH_TOOLS.has(toolName)) {
                  if (state === "output-error") {
                    return null;
                  }
                  return (
                    <ResearchStep
                      key={toolCallId}
                      toolCallId={toolCallId}
                      toolName={toolName as ResearchToolName}
                      state={state}
                      args={toolInput}
                      result={
                        state === "output-available" ? toolOutput : undefined
                      }
                    />
                  );
                }

                if (state === "input-available" && toolInput) {
                  return (
                    <div key={toolCallId}>
                      <Tool
                        state={state as ToolInvocationState}
                        toolName={toolName as Tools}
                        args={toolInput}
                        isReadonly={isReadonly}
                        setInput={setInput}
                        status={status}
                        isLastMessage={isLastMessage}
                      />
                    </div>
                  );
                }

                if (state === "output-available" && toolOutput) {
                  return (
                    <div key={toolCallId}>
                      <Tool
                        state={state as ToolInvocationState}
                        toolName={toolName as Tools}
                        result={toolOutput}
                        isReadonly={isReadonly}
                        setInput={setInput}
                        status={status}
                        isLastMessage={isLastMessage}
                      />
                    </div>
                  );
                }
              }
            })}

            {showStreamingDots && <ThinkingDots />}
          </div>
        </div>
      </div>
      {previewAttachment && (
        <DocumentPreviewDialog
          id={previewAttachment.url}
          filename={
            previewAttachment.name ??
            previewAttachment.url.split("/").at(-1) ??
            "Document"
          }
          url={previewAttachment.url}
          mimeType={previewAttachment.contentType}
          open={!!previewAttachment}
          onOpenChange={(open) => {
            if (!open) setPreviewAttachment(null);
          }}
        />
      )}
    </>
  );
};

export const PreviewMessage = PurePreviewMessage;

export const ThinkingMessage = () => {
  return (
    <motion.div
      data-testid="message-assistant-loading"
      className={cn(CHAT_MESSAGE_ROW_CLASS, "group/message")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.6, duration: 0.2 } }}
      data-role="assistant"
    >
      <div className="flex w-full gap-4">
        <AssistantAvatar />
        <div className="flex w-full flex-col gap-2">
          <ThinkingDots />
        </div>
      </div>
    </motion.div>
  );
};

/** Assistant mark: small round glass chip with the brand sparkle. */
const AssistantAvatar = () => (
  <div className="glass flex size-8 shrink-0 items-center justify-center rounded-full text-brand-800">
    <SparklesIcon size={14} />
  </div>
);
