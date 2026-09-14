"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";

import { useChat } from "@ai-sdk/react";
import { type ChatStatus, DefaultChatTransport, type UIMessage } from "ai";

import type { Attachment } from "@wildfires-org/turboplan-chat-actions/types";

import type { ArtifactStreamDelta } from "@/components/data-stream-handler";

/**
 * Compat type matching the old v4 UseChatHelpers shape.
 * Components should import this instead of UseChatHelpers from @ai-sdk/react.
 * Only the internals of useChatCompat use v6 APIs — this type stays stable.
 */
export type ChatHelpers = {
  id: string;
  messages: UIMessage[];
  setMessages: (
    messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[]),
  ) => void;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  handleSubmit: (
    event?: { preventDefault?: () => void },
    options?: { experimental_attachments?: Attachment[] },
  ) => void;
  append: (
    message: { role: "user"; content: string },
    options?: {
      body?: Record<string, unknown>;
      experimental_attachments?: Attachment[];
    },
  ) => void;
  reload: () => void;
  status: ChatStatus;
  stop: () => void;
};

export const useChatCompat = ({
  id,
  body,
  initialMessages,
  generateId,
  onFinish,
  onError,
  onArtifactDelta,
}: {
  id: string;
  body?: Record<string, unknown>;
  initialMessages?: UIMessage[];
  generateId?: () => string;
  onFinish?: () => void;
  onError?: (error: Error) => void;
  onArtifactDelta?: (delta: ArtifactStreamDelta) => void;
}): ChatHelpers => {
  const [input, setInput] = useState("");

  const { messages, setMessages, sendMessage, regenerate, stop, status } =
    useChat({
      id,
      generateId,
      messages: initialMessages,
      // Coalesce high-frequency stream updates into ~20fps paints. Combined with
      // server-side smoothStream({ chunking: "word" }), this yields smooth,
      // natural word-by-word streaming without choppy per-token re-renders.
      experimental_throttle: 50,
      transport: new DefaultChatTransport({
        api: "/api/chat",
        body,
      }),
      onFinish: onFinish ? () => onFinish() : undefined,
      onError: onError ? (error) => onError(error) : undefined,
      onData: onArtifactDelta
        ? (dataPart) => {
            if (dataPart.type === "data-artifact") {
              onArtifactDelta(dataPart.data as ArtifactStreamDelta);
            }
          }
        : undefined,
    });

  const handleSubmit = useCallback(
    (
      event?: { preventDefault?: () => void },
      options?: { experimental_attachments?: Attachment[] },
    ) => {
      event?.preventDefault?.();
      if (!input.trim() && !options?.experimental_attachments?.length) {
        return;
      }

      const files = options?.experimental_attachments?.map((a) => ({
        type: "file" as const,
        url: a.url,
        mediaType: a.contentType || "application/octet-stream",
        filename: a.name,
      }));

      sendMessage({
        text: input,
        files,
      });
      setInput("");
    },
    [input, sendMessage],
  );

  const append = useCallback(
    (
      message: { role: "user"; content: string },
      options?: {
        body?: Record<string, unknown>;
        experimental_attachments?: Attachment[];
      },
    ) => {
      const files = options?.experimental_attachments?.map((a) => ({
        type: "file" as const,
        url: a.url,
        mediaType: a.contentType || "application/octet-stream",
        filename: a.name,
      }));

      sendMessage(
        { text: message.content, files },
        options?.body ? { body: options.body } : undefined,
      );
    },
    [sendMessage],
  );

  const reload = useCallback(() => {
    regenerate();
  }, [regenerate]);

  return {
    id,
    messages,
    setMessages,
    input,
    setInput,
    handleSubmit,
    append,
    reload,
    status,
    stop,
  };
};
