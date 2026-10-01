import type { ChatStatus } from "ai";

/**
 * True while a chat request is in flight. `"error"` counts as idle: after a
 * broken stream the user must be able to send again without reloading.
 */
export const isChatBusy = (status: ChatStatus | undefined): boolean =>
  status === "submitted" || status === "streaming";

/**
 * A tool part still waiting on input or output once its message has stopped
 * streaming (dropped connection, stop, server teardown) will never complete.
 */
export const isToolPartInterrupted = (
  state: string,
  isMessageLoading: boolean,
): boolean =>
  !isMessageLoading &&
  (state === "input-streaming" || state === "input-available");

const TOOL_ERROR_LABELS: Record<string, string> = {
  createDocument: "creating the document",
  updateDocument: "updating the document",
  requestSuggestions: "adding suggestions",
  readProjectDocuments: "reading the project documents",
  updateProjectContext: "updating the project context",
  updateProjectFields: "updating the project fields",
};

export const getToolErrorMessage = (toolName: string): string =>
  `Couldn't finish ${TOOL_ERROR_LABELS[toolName] ?? "this step"}. Try again.`;
