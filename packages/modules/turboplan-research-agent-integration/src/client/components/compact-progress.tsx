"use client";

import { useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Check, FileText } from "lucide-react";

import type {
  ProgressMessageData,
  ResearchAgentMessage,
  ResearchAgentStatus,
} from "../../types";
import { ResearchAgentMessageType } from "../../types";
import { useElapsedTime } from "../hooks/use-elapsed-time";
import { AvatarThinking } from "./avatar-thinking";

type CompactProgressProps = {
  status: ResearchAgentStatus | undefined;
  progressMessages: ResearchAgentMessage[];
};

export const CompactProgress = ({
  status,
  progressMessages,
}: CompactProgressProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isActive = status?.hasActiveRun ?? false;
  const isCompleted = status?.status === "completed";
  const currentStep = isCompleted
    ? "Research completed"
    : status?.currentStep || "Processing...";
  const elapsedTime = useElapsedTime(
    status?.createdAt,
    status?.updatedAt,
    isActive,
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-purple-100 dark:border-purple-800/30 bg-gradient-to-r from-purple-50/60 to-violet-50/40 dark:from-purple-950/20 dark:to-violet-950/10 px-4 py-3 mb-1.5"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center gap-3 w-full text-left cursor-pointer"
      >
        <AvatarThinking
          state={isCompleted ? "idle" : "thinking"}
          className="size-8 shrink-0"
        />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isCompleted ? (
            <Check className="size-3.5 text-emerald-600 shrink-0" />
          ) : (
            <FileText className="size-3 text-muted-foreground shrink-0" />
          )}
          <span className="text-xs font-medium text-purple-600 dark:text-purple-300 truncate">
            {currentStep}
          </span>
          {elapsedTime && (
            <span className="text-xs font-medium tabular-nums text-purple-500 dark:text-purple-400 shrink-0">
              {elapsedTime}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ArrowDownLeft className="size-4 shrink-0 text-purple-500" />
        ) : (
          <ArrowUpRight className="size-4 shrink-0 text-purple-500" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && progressMessages.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.455, 0.03, 0.515, 0.955] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col mt-2 pl-11">
              {progressMessages.map((msg) => {
                if (msg.type !== ResearchAgentMessageType.PROGRESS) {
                  return null;
                }
                const data = msg.data as ProgressMessageData;
                return (
                  <span
                    key={msg.id}
                    className="text-xs text-muted-foreground/70 leading-5"
                  >
                    &lsaquo; {data.step}
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
