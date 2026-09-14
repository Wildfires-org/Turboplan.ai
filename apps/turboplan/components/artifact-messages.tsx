import { memo } from "react";

import type { UIMessage } from "ai";

import type { ChatHelpers } from "@/hooks/use-chat-compat";
import { UIArtifact } from "./artifact";
import { PreviewMessage } from "./message";
import { useScrollToBottom } from "./use-scroll-to-bottom";

interface ArtifactMessagesProps {
  chatId: string;
  status: ChatHelpers["status"];
  messages: Array<UIMessage>;
  setMessages: ChatHelpers["setMessages"];
  reload: ChatHelpers["reload"];
  isReadonly: boolean;
  artifactStatus: UIArtifact["status"];
  append: ChatHelpers["append"];
  setInput: ChatHelpers["setInput"];
}

function PureArtifactMessages({
  chatId: _chatId,
  status,
  messages,
  setMessages,
  reload,
  isReadonly,
  append: _append,
  setInput,
}: ArtifactMessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col gap-4 size-full items-center overflow-y-scroll px-4 pt-20"
    >
      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          message={message}
          isLoading={status === "streaming" && index === messages.length - 1}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isLastMessage={index === messages.length - 1}
          setInput={setInput}
          status={status}
        />
      ))}

      <div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
      />
    </div>
  );
}

function areEqual(
  prevProps: ArtifactMessagesProps,
  nextProps: ArtifactMessagesProps,
) {
  if (
    prevProps.artifactStatus === "streaming" &&
    nextProps.artifactStatus === "streaming"
  )
    return true;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.status && nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;

  return true;
}

export const ArtifactMessages = memo(PureArtifactMessages, areEqual);
