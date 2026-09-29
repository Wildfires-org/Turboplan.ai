"use client";

import { useState } from "react";

import { ChevronDown, ChevronUp, Clock } from "lucide-react";

import type { TimelineDisplayEntry } from "@wildfires-org/turboplan-timeline-records/client";

import { EMPTY_STATE_TITLE_CLASS, SKELETON_BAR_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { TimelineEntry } from "./timeline-entry";

const VISIBLE_ENTRIES_LIMIT = 4;

interface TimelineContentProps {
  entries: TimelineDisplayEntry[];
  isLoading: boolean;
  error: string | null;
  readOnly?: boolean;
  onDeleteEntry?: (id: string) => Promise<void>;
  onToggleVisibility?: (id: string) => Promise<void>;
}

export function TimelineContent({
  entries,
  isLoading,
  error,
  readOnly = false,
  onDeleteEntry,
  onToggleVisibility,
}: TimelineContentProps) {
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    // Mirrors TimelineEntry's rows (24px meta row, pt-2/pb-6 around a
    // title-only card) so entries land without moving the page.
    return (
      <div aria-hidden className="flex max-w-[720px] flex-col gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex h-6 items-center gap-4">
              <div
                className={cn(
                  SKELETON_BAR_CLASS,
                  "size-6 shrink-0 rounded-full",
                )}
              />
              <div className={cn(SKELETON_BAR_CLASS, "h-3 w-48")} />
            </div>
            <div className="flex gap-4">
              <div className="w-6 shrink-0" />
              <div className="flex-1 pb-6 pt-2">
                <div
                  className={cn(SKELETON_BAR_CLASS, "h-[62px] rounded-2xl")}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-sm text-error-700">
        Failed to load timeline entries.
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <span className="glass flex size-10 items-center justify-center rounded-full text-brand-800">
          <Clock aria-hidden className="size-5" />
        </span>
        <p className={EMPTY_STATE_TITLE_CLASS}>No timeline entries yet</p>
      </div>
    );
  }

  const visibleEntries = showAll
    ? entries
    : entries.slice(0, VISIBLE_ENTRIES_LIMIT);

  return (
    <div className="flex max-w-[720px] flex-col gap-1">
      {visibleEntries.map((entry, idx) => (
        <TimelineEntry
          key={entry.id}
          entry={entry}
          isLast={idx === visibleEntries.length - 1}
          readOnly={readOnly}
          onDelete={onDeleteEntry}
          onToggleVisibility={onToggleVisibility}
        />
      ))}
      {entries.length > VISIBLE_ENTRIES_LIMIT && (
        <button
          type="button"
          className="mt-1 flex w-fit items-center gap-1 rounded-md text-xs font-medium text-brand-800 hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          onClick={() => setShowAll((prev) => !prev)}
        >
          {showAll ? (
            <>
              <ChevronUp className="size-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="size-3" />
              Show {entries.length - VISIBLE_ENTRIES_LIMIT} more
            </>
          )}
        </button>
      )}
    </div>
  );
}
