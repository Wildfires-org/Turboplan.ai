"use client";

import { useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, Lightbulb, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { ChevronDownIcon, LoaderIcon } from "../icons";
import { ExpandableText } from "./expandable-text";
import { ResultItem } from "./result-item";
import type { ResearchStepProps } from "./types";
import {
  cleanExcerpt,
  expandTransition,
  getExcerpt,
  getLabel,
  getResultsArray,
} from "./utils";

const MAX_TRACKED_IDS = 500;
const expandedToolCalls = new Set<string>();

export const ResearchStep = ({
  toolCallId,
  toolName,
  state,
  args,
  result,
}: ResearchStepProps) => {
  const [isExpanded, setIsExpanded] = useState(() =>
    expandedToolCalls.has(toolCallId),
  );
  const isComplete = state === "output-available" || state === "output-error";

  const Icon =
    toolName === "webSearch"
      ? Search
      : toolName === "getContents"
        ? FileText
        : Lightbulb;
  const label = getLabel(toolName, isComplete, args);
  const results = getResultsArray(result);

  const hasContent =
    isComplete &&
    ((toolName !== "researchNotes" && results.length > 0) ||
      (toolName === "researchNotes" &&
        Boolean(result?.content || args?.content)));

  return (
    <div className="research-step [.research-step+&]:-mt-2 flex flex-col ml-1">
      <button
        type="button"
        className={cn(
          "-mx-2 flex items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700",
          hasContent && "cursor-pointer hover:bg-white/70",
        )}
        onClick={() => {
          if (hasContent) {
            setIsExpanded((prev) => {
              const next = !prev;
              if (next) {
                if (expandedToolCalls.size >= MAX_TRACKED_IDS) {
                  const first = expandedToolCalls.values().next().value;
                  if (first !== undefined) {
                    expandedToolCalls.delete(first);
                  }
                }
                expandedToolCalls.add(toolCallId);
              } else {
                expandedToolCalls.delete(toolCallId);
              }
              return next;
            });
          }
        }}
      >
        <Icon size={14} className="shrink-0 text-brand-800" />
        <span className="max-w-[400px] truncate text-xs text-gray-550">
          {label}
        </span>
        {!isComplete ? (
          <div className="shrink-0 animate-spin text-brand-800">
            <LoaderIcon size={14} />
          </div>
        ) : (
          hasContent && (
            <motion.span
              className="block shrink-0 text-gray-550"
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={expandTransition}
            >
              <ChevronDownIcon size={14} />
            </motion.span>
          )
        )}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={expandTransition}
            style={{ overflow: "hidden" }}
          >
            <div className="pl-5 mt-1 mb-2 flex flex-col gap-1">
              {toolName === "webSearch" && typeof args?.query === "string" && (
                <p className="mb-1 text-xs text-gray-550">
                  Search query: &ldquo;{args.query}&rdquo;
                </p>
              )}
              {(toolName === "webSearch" || toolName === "getContents") &&
                results.map((r) => (
                  <ResultItem
                    key={r.url}
                    title={r.title || r.url}
                    url={r.url}
                    excerpt={getExcerpt(r)}
                  />
                ))}
              {toolName === "researchNotes" && (
                <div className="border-l-2 border-brand-700/25 pl-3">
                  <ExpandableText
                    text={cleanExcerpt(
                      String(result?.content || args?.content || ""),
                    )}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
