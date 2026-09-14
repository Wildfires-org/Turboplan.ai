import { useEffect, useRef } from "react";

import type { UIMessage } from "ai";

import type { ChatHelpers } from "@/hooks/use-chat-compat";
import { getResearchSavedData } from "@/lib/research-saved-annotation";
import { ResearchSavedCard } from "./chat/research-saved-card";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";
import { SystemPromptDebug } from "./system-prompt-debug";
import { useScrollToBottom } from "./use-scroll-to-bottom";

interface MessagesProps {
  chatId: string;
  status: ChatHelpers["status"];
  messages: Array<UIMessage>;
  setMessages: ChatHelpers["setMessages"];
  reload: ChatHelpers["reload"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  append: ChatHelpers["append"];
  setInput: ChatHelpers["setInput"];
  projectId?: string;
}

function PureMessages({
  chatId,
  status,
  messages,
  setMessages,
  reload,
  isReadonly,
  append,
  setInput,
  projectId,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef, scrollToBottom] =
    useScrollToBottom<HTMLDivElement>();

  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    if (
      messages.length > prevMessageCountRef.current &&
      messages[messages.length - 1]?.role === "user"
    ) {
      scrollToBottom();
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
    >
      {messages.length === 0 && <Greeting />}

      <SystemPromptDebug projectId={projectId} chatId={chatId} />

      {messages.map((message, index) => {
        const researchSavedData = getResearchSavedData(message);
        if (researchSavedData) {
          return (
            <ResearchSavedCard
              key={message.id}
              sections={researchSavedData.sections}
              totalSaved={researchSavedData.totalSaved}
            />
          );
        }

        return (
          <PreviewMessage
            key={message.id}
            message={message}
            isLoading={status === "streaming" && messages.length - 1 === index}
            setMessages={setMessages}
            reload={reload}
            isReadonly={isReadonly}
            isLastMessage={index === messages.length - 1}
            setInput={setInput}
            status={status}
          />
        );
      })}

      {status === "submitted" &&
        messages.length > 0 &&
        messages[messages.length - 1].role === "user" && <ThinkingMessage />}

      <div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px] pb-4"
      />
    </div>
  );
}

export const Messages = PureMessages;
