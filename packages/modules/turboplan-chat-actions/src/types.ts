/**
 * This file contains the types for the chat actions component.
 */

import type { Dispatch, SetStateAction } from "react";

import type { ChatStatus } from "ai";
export type Attachment = {
  name?: string;
  contentType?: string;
  url: string;
};

/**
 * A chat action is a button that can be clicked to send a message to the chat.
 * @param label - The label of the action.
 * @param message - The message to send when the action is clicked.
 * @param icon - The icon to display in the action button.
 */
export type ChatAction = {
  label: string;
  message: string;
  icon: string;
};

/**
 * The props for the chat actions component.
 * @param append - The function to append a message to the chat.
 * @param chatId - The ID of the chat.
 * @param attachments - The attachments to send with the message.
 * @param setAttachments - The function to set the attachments.
 * @param chatActions - The actions to display in the chat.
 * @param status - The status of the chat.
 */
export type ChatActionsProps = {
  append: (
    message: { role: "user"; content: string },
    options?: {
      body?: Record<string, unknown>;
      experimental_attachments?: Array<Attachment>;
    },
  ) => void;
  chatId: string;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  chatActions: ChatAction[];
  status?: ChatStatus;
};

/**
 * The status of the chat actions component.
 */
export type Status = "loading" | "ready";
