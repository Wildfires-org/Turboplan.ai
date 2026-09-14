"use client";

import { useState } from "react";

import type { UIMessage } from "ai";
import cx from "classnames";
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
  const withoutPrefix = decoded.replace(/^\d+-/, "");
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
        className="w-full mx-auto max-w-3xl px-4 group/message"
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
          {message.role === "assistant" && (
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
              <div className="translate-y-px">
                <SparklesIcon size={14} />
              </div>
            </div>
          )}

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
                              className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
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
                        className={cn("flex flex-col gap-4", {
                          "bg-chat-user text-chat-user-foreground px-3 py-2 rounded-xl":
                            message.role === "user",
                        })}
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
  const role = "assistant";

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          "flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl",
          {
            "group-data-[role=user]/message:bg-muted": true,
          },
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <ThinkingDots />
        </div>
      </div>
    </motion.div>
  );
};
