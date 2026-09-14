"use client";

import { useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  FileText,
  PanelRightClose,
} from "lucide-react";

import { Button, cn } from "@wildfires-org/turboplan-utils";

import type {
  ProgressMessageData,
  ResearchAgentMessage,
  ResearchAgentStatus,
} from "../../types";
import { useElapsedTime } from "../hooks/use-elapsed-time";
import { AvatarThinking } from "./avatar-thinking";

type ResearchPanelHeaderProps = {
  status: ResearchAgentStatus | undefined;
  progressMessages: ResearchAgentMessage[];
  onClose: () => void;
  hideStatus?: boolean;
};

export function ResearchPanelHeader({
  status,
  progressMessages,
  onClose,
  hideStatus,
}: ResearchPanelHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isActive = status?.hasActiveRun ?? false;
  const isCompleted = status?.status === "completed";
  const shouldShow = (isActive || isCompleted) && !hideStatus;

  const elapsedTime = useElapsedTime(
    status?.createdAt,
    status?.updatedAt,
    isActive,
  );

  const currentStep = isCompleted
    ? "Project Bootstrapped Successfully"
    : status?.currentStep || "Processing...";

  return (
    <div>
      <div className="flex items-center justify-between">
        <Button
          variant="ghost-outline"
          onClick={onClose}
          className="gap-2 text-base font-semibold h-auto py-1.5 px-3"
        >
          <PanelRightClose className="size-5 text-neutral-500" />
          Research
        </Button>

        {shouldShow && !isExpanded && (
          <Button
            type="button"
            onClick={() => setIsExpanded(true)}
            variant="ghost-outline"
            size="xs"
          >
            {isCompleted ? (
              <Check className="size-3.5 text-emerald-600 shrink-0" />
            ) : (
              <FileText className="size-3 text-muted-foreground shrink-0" />
            )}
            <span
              className={cn(
                "text-xs truncate max-w-[190px]",
                isCompleted ? "text-emerald-600" : "text-muted-foreground",
              )}
            >
              {currentStep}
            </span>
            <AvatarThinking
              state={isCompleted ? "idle" : "thinking"}
              className="size-8"
            />
            {elapsedTime && (
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  isCompleted ? "text-emerald-600" : "text-muted-foreground",
                )}
              >
                {elapsedTime}
              </span>
            )}
            <ArrowUpRight
              className={cn(
                "size-3.5 shrink-0 text-purple-300",
                isCompleted ? "text-emerald-600" : "text-purple-500",
              )}
            />
          </Button>
        )}

        {shouldShow && isExpanded && (
          <Button
            type="button"
            variant="ghost-outline"
            size="xs"
            onClick={() => setIsExpanded(false)}
          >
            Hide thinking
            <ArrowDownLeft className="size-3.5 shrink-0 text-purple-500" />
          </Button>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && shouldShow && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.455, 0.03, 0.515, 0.955] }}
            className="overflow-hidden"
          >
            <div className="pt-4 pl-1">
              <div className="text-sm text-muted-foreground">
                {currentStep}
                {elapsedTime ? ` (${elapsedTime})` : ""}
              </div>
              {progressMessages.length > 0 && (
                <div className="flex flex-col mt-1">
                  {progressMessages.map((msg) => {
                    const data = msg.data as ProgressMessageData;
                    return (
                      <span
                        key={msg.id}
                        className="text-xs text-muted-foreground/70 leading-5"
                      >
                        └ {data.step}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
