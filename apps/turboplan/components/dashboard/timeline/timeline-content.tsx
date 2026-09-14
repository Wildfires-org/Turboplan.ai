"use client";

import { useState } from "react";

import { ChevronDown, ChevronUp, Clock } from "lucide-react";

import type { TimelineDisplayEntry } from "@wildfires-org/turboplan-timeline-records/client";

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
    return (
      <div className="flex max-w-[720px] flex-col gap-4 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <div className="size-6 shrink-0 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="flex gap-4">
              <div className="w-6 shrink-0" />
              <div className="h-24 flex-1 animate-pulse rounded-lg bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-sm text-gray-500">
        Failed to load timeline entries.
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Clock className="size-8 text-gray-300" />
        <p className="text-sm text-gray-500">No timeline entries yet.</p>
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
          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 font-medium mt-1"
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
