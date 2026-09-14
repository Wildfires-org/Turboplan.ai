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
const collapsedReasoning = new Set<string>();

export function MessageReasoning({
  id,
  isLoading,
  reasoning,
}: MessageReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(
    () => !collapsedReasoning.has(id),
  );

  return (
    <div className="flex flex-col">
      {isLoading ? (
        <div className="flex flex-row gap-2 items-center">
          <div className="font-medium">Reasoning</div>
          <div className="animate-spin">
            <LoaderIcon />
          </div>
        </div>
      ) : (
        <div className="flex flex-row gap-2 items-center">
          <div className="font-medium">Reasoned for a few seconds</div>
          <button
            data-testid="message-reasoning-toggle"
            type="button"
            className="cursor-pointer"
            onClick={() => {
              setIsExpanded((prev) => {
                const next = !prev;
                if (next) {
                  collapsedReasoning.delete(id);
                } else {
                  if (collapsedReasoning.size >= MAX_TRACKED_IDS) {
                    const first = collapsedReasoning.values().next().value;
                    if (first !== undefined) {
                      collapsedReasoning.delete(first);
                    }
                  }
                  collapsedReasoning.add(id);
                }
                return next;
              });
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
            <div className="mt-4 mb-2 pl-4 text-zinc-600 dark:text-zinc-400 border-l flex flex-col gap-4">
              <Markdown>{reasoning}</Markdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
