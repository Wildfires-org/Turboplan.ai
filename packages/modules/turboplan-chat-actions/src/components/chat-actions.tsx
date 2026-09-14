"use client";

import { memo, useEffect, useRef, useState } from "react";

import { useWindowSize } from "usehooks-ts";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
} from "@wildfires-org/turboplan-utils";

import type { ChatActionsProps, Status } from "../types";

function PureChatActions({
  append,
  chatId,
  attachments,
  setAttachments,
  chatActions,
  status: parentStatus,
}: ChatActionsProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [visibleButtonsCount, setVisibleButtonsCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hiddenButtonsContainerRef = useRef<HTMLDivElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (!containerRef.current || !hiddenButtonsContainerRef.current) {
      return;
    }

    const containerWidth = containerRef.current.clientWidth;
    const hiddenButtons =
      hiddenButtonsContainerRef.current.querySelectorAll("button");

    let totalWidth = 0;
    let count = 0;
    const allButtonWidth = 80;
    const gap = 8;

    for (let i = 0; i < hiddenButtons.length; i++) {
      const buttonWidth = hiddenButtons[i].offsetWidth;
      const projectedWidth = totalWidth + buttonWidth + (i > 0 ? gap : 0);

      if (projectedWidth + allButtonWidth + gap > containerWidth) {
        break;
      }

      totalWidth = projectedWidth;
      count++;
    }

    setVisibleButtonsCount(count);
    setStatus("ready");
  }, [width, status]);

  const handleClick = (message: string) => {
    // Don't allow sending if parent component is not ready
    if (parentStatus && parentStatus !== "ready") {
      return;
    }

    window.history.replaceState({}, "", `/chat/${chatId}`);

    // Send the message with any existing attachments
    append(
      {
        content: message,
        role: "user",
      },
      {
        experimental_attachments: attachments,
      },
    );

    // Clear attachments after sending
    setAttachments([]);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && triggerRef.current) {
      triggerRef.current.blur();
    }
  };

  const showAllButton = visibleButtonsCount < chatActions.length;
  const isDisabled =
    status === "loading" || (parentStatus && parentStatus !== "ready");

  return (
    <>
      <div
        ref={hiddenButtonsContainerRef}
        className="fixed -z-10 flex flex-nowrap gap-2"
        style={{ top: 0, left: 0, visibility: "hidden" }}
      >
        {chatActions.map((action) => (
          <Button
            type="button"
            key={action.label}
            variant="outline"
            className="rounded-full whitespace-nowrap"
          >
            <span className="mr-2">{action.icon}</span>
            {action.label}
          </Button>
        ))}
      </div>

      <div
        ref={containerRef}
        className="flex w-full flex-nowrap justify-center gap-2 overflow-hidden mt-2"
      >
        {status === "loading" ? (
          <>
            {Array.from({ length: 4 }, (_, i) => `skeleton-${i + 1}`).map(
              (id) => (
                <Skeleton key={id} className="h-10 w-32 rounded-full" />
              ),
            )}
            <Skeleton className="h-10 w-20 rounded-full" />
          </>
        ) : (
          <>
            {chatActions.slice(0, visibleButtonsCount).map((action) => (
              <Button
                type="button"
                key={action.label}
                variant="outline"
                className="rounded-full whitespace-nowrap"
                onClick={() => handleClick(action.message)}
                disabled={isDisabled}
              >
                <span className="mr-2">{action.icon}</span>
                {action.label}
              </Button>
            ))}
            {showAllButton && (
              <DropdownMenu onOpenChange={handleOpenChange}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    ref={triggerRef}
                    variant="outline"
                    className="rounded-full border focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={isDisabled}
                  >
                    All {chatActions.length}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="max-h-60 overflow-y-auto"
                  align="end"
                >
                  {chatActions.map((action) => (
                    <DropdownMenuItem
                      key={action.label}
                      onClick={() => handleClick(action.message)}
                      className={`cursor-pointer ${
                        isDisabled ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      <span className="mr-2">{action.icon}</span>
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </div>
    </>
  );
}

export const ChatActions = memo(PureChatActions);
