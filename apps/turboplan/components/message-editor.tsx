"use client";

import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

import type { UIMessage } from "ai";

import { Button, Textarea } from "@wildfires-org/turboplan-utils";

import { deleteTrailingMessages } from "@/app/(dashboard)/organizations/[orgSlug]/offices/[officeSlug]/projects/[projectSlug]/chat/actions";
import type { ChatHelpers } from "@/hooks/use-chat-compat";

const getMessageText = (message: UIMessage): string => {
  const textPart = message.parts?.find((part) => part.type === "text");
  if (textPart && "text" in textPart) {
    return textPart.text;
  }
  return "";
};

export type MessageEditorProps = {
  message: UIMessage;
  setMode: Dispatch<SetStateAction<"view" | "edit">>;
  setMessages: ChatHelpers["setMessages"];
  reload: ChatHelpers["reload"];
};

export function MessageEditor({
  message,
  setMode,
  setMessages,
  reload,
}: MessageEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [draftContent, setDraftContent] = useState<string>(() =>
    getMessageText(message),
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftContent(event.target.value);
    adjustHeight();
  };

  const submitForm = async () => {
    if (isSubmitting || !draftContent.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await deleteTrailingMessages({
        id: message.id,
      });
    } catch (error) {
      // Leave the editor usable instead of a permanent "Sending..." state.
      console.error("Failed to delete trailing messages:", error);
      setIsSubmitting(false);
      return;
    }

    setMessages((messages) => {
      const index = messages.findIndex((m) => m.id === message.id);

      if (index !== -1) {
        const updatedMessage = {
          ...message,
          content: draftContent,
          parts: [{ type: "text" as const, text: draftContent }],
        };

        return [...messages.slice(0, index), updatedMessage];
      }

      return messages;
    });

    setMode("view");
    reload();
  };

  return (
    <div className="flex flex-col gap-2 w-full" data-message-editor>
      <Textarea
        data-testid="message-editor"
        ref={textareaRef}
        className="border-input bg-transparent shadow-none outline-none overflow-hidden resize-none !text-base rounded-xl w-full"
        value={draftContent}
        onChange={handleInput}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            submitForm();
          }
        }}
      />

      <div className="flex flex-row gap-2 justify-end">
        <Button
          variant="outline"
          className="h-fit py-2 px-3"
          onClick={() => {
            setMode("view");
          }}
        >
          Cancel
        </Button>
        <Button
          data-testid="message-editor-send-button"
          variant="default"
          className="h-fit py-2 px-3"
          disabled={isSubmitting}
          onClick={submitForm}
        >
          {isSubmitting ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
