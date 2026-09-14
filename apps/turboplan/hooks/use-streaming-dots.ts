import { useEffect, useState } from "react";

import type { UIMessage } from "ai";

/**
 * Show "thinking dots" below the assistant message while it's generating?
 *
 * - YES when the model is working but nothing visible is changing on screen
 *   (e.g. between tool calls, after a tool result, before next text starts)
 * - NO  while text is actively appearing (the growing text IS the indicator)
 *
 * The 400ms timer handles the gap between "text stops arriving" and
 * "next tool-call part appears". Without it, dots would briefly vanish.
 */
const TEXT_PAUSE_MS = 400;

export const useStreamingDots = (
  isLoading: boolean,
  message: UIMessage,
): boolean => {
  // Becomes true when text hasn't changed for TEXT_PAUSE_MS
  const [textPaused, setTextPaused] = useState(false);

  const lastPart = message.parts?.[message.parts.length - 1];
  const isLastPartText = lastPart?.type === "text";

  // null when not streaming or last part isn't text — we only care about text changes
  const currentText = isLoading && isLastPartText ? lastPart.text : null;

  // Every time the text content changes, restart a 400ms timer.
  // If the timer fires without being reset, text has paused.
  useEffect(() => {
    if (currentText === null) {
      setTextPaused(false);
      return;
    }
    setTextPaused(false);
    const timer = setTimeout(() => setTextPaused(true), TEXT_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [currentText]);

  // Not an actively streaming assistant message — no dots
  if (!isLoading || message.role !== "assistant") {
    return false;
  }
  // v6 flips status to "streaming" and appends an empty assistant message
  // before the first chunk arrives. During that gap (model thinking / server
  // context-load) there are no parts yet — show dots so the UI isn't blank.
  if (!message.parts?.length) {
    return true;
  }
  // Text is actively streaming — no dots (text growth is the indicator)
  if (isLastPartText && !textPaused) {
    return false;
  }
  return true;
};
