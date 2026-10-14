"use client";

import { useState } from "react";

import { AnimatePresence, motion } from "framer-motion";

import { ChevronDownIcon, LoaderIcon } from "./icons";
import { Markdown } from "./markdown";

interface MessageReasoningProps {
  id: string;
  isLoading: boolean;
  reasoning: string;
}

const expandTransition = {
  duration: 0.25,
  ease: [0.32, 0.72, 0, 1],
};

const MAX_TRACKED_IDS = 500;
// Explicit open/closed choices, kept across remounts. Without one, reasoning is
// open while the reply streams and folds away once it is done.
const userChoices = new Map<string, boolean>();

const rememberChoice = (id: string, isExpanded: boolean) => {
  userChoices.delete(id);
  if (userChoices.size >= MAX_TRACKED_IDS) {
    const oldest = userChoices.keys().next().value;
    if (oldest !== undefined) {
      userChoices.delete(oldest);
    }
  }
  userChoices.set(id, isExpanded);
};

export function MessageReasoning({
  id,
  isLoading,
  reasoning,
}: MessageReasoningProps) {
  const [userChoice, setUserChoice] = useState<boolean | undefined>(() =>
    userChoices.get(id),
  );
  const isExpanded = userChoice ?? isLoading;

  return (
    <div className="flex flex-col">
      {isLoading ? (
        <div className="flex flex-row items-center gap-2 text-[13px] text-gray-550">
          <div className="font-medium">Reasoning</div>
          <div className="animate-spin text-brand-800">
            <LoaderIcon />
          </div>
        </div>
      ) : (
        <div className="flex flex-row items-center gap-2 text-[13px] text-gray-550">
          <div className="font-medium">Reasoned for a few seconds</div>
          <button
            data-testid="message-reasoning-toggle"
            type="button"
            aria-label={isExpanded ? "Hide reasoning" : "Show reasoning"}
            aria-expanded={isExpanded}
            className="press flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-white/70 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
            onClick={() => {
              rememberChoice(id, !isExpanded);
              setUserChoice(!isExpanded);
            }}
          >
            <motion.span
              className="block"
              animate={{ rotate: isExpanded ? 0 : -90 }}
              transition={expandTransition}
            >
              <ChevronDownIcon />
            </motion.span>
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            data-testid="message-reasoning"
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={expandTransition}
            style={{ overflow: "hidden" }}
          >
            <div className="mb-2 mt-3 flex flex-col gap-4 border-l-2 border-brand-700/25 pl-4 text-[14px] text-gray-550 dark:text-slate-400">
              <Markdown>{reasoning}</Markdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
