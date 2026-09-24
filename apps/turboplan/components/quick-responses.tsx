"use client";

import { memo, useEffect, useState } from "react";

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@wildfires-org/turboplan-utils";

import type { ChatHelpers } from "@/hooks/use-chat-compat";
import type { QuickResponse } from "@/lib/ai/tools/generate-quick-responses";
import { cn } from "@/lib/utils";

interface QuickResponsesProps {
  quickResponses: QuickResponse[];
  setInput: ChatHelpers["setInput"];
  status?: ChatHelpers["status"];
  isLastMessage: boolean;
}

function PureQuickResponses({
  quickResponses,
  setInput,
  status,
  isLastMessage,
}: QuickResponsesProps) {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);

  // Auto-paste highlighted response after 500ms (only for last message)
  useEffect(() => {
    if (!isLastMessage || status !== "ready") return;

    const highlightedResponse = quickResponses.find((r) => r.isHighlighted);
    if (!highlightedResponse) return;

    const highlightedIdx = quickResponses.findIndex((r) => r.isHighlighted);
    setHighlightedIndex(highlightedIdx);
    setIsPulsing(true);

    const timer = setTimeout(() => {
      // Only auto-fill when the input is still empty — never clobber text the
      // user has typed (checked at fire-time via the functional updater).
      setInput((prev) =>
        prev.trim() === "" ? highlightedResponse.message : prev,
      );
      setIsPulsing(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [quickResponses, isLastMessage, status, setInput]);

  const handleClick = (message: string) => {
    if (status && status !== "ready") return;

    // Paste message into input field for user to review/edit before sending
    setInput(message);
  };

  const isDisabled = status && status !== "ready";

  // Only show for last message
  if (!isLastMessage) return null;

  return (
    <div className="flex flex-wrap justify-start gap-2 mt-3">
      {quickResponses.map((response, index) => {
        const isHighlighted = highlightedIndex === index;
        const shouldPulse = isHighlighted && isPulsing;

        return (
          <div key={`quick-response-${response.title}-${index}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="glass"
                  size="sm"
                  className={cn(
                    "h-8 whitespace-nowrap rounded-full px-3.5 text-[13px] text-foreground",
                    shouldPulse &&
                      "outline outline-2 outline-offset-2 outline-brand-700",
                  )}
                  onClick={() => handleClick(response.message)}
                  disabled={isDisabled}
                >
                  {response.title}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {response.message}
              </TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}

export const QuickResponses = memo(PureQuickResponses);
