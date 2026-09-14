"use client";

import { Clock, ExternalLink, Paperclip, User } from "lucide-react";

import { cn } from "@wildfires-org/turboplan-utils";

import type { TimelineDisplayEntry } from "./transform-timeline";

interface ReadOnlyTimelineEntryProps {
  entry: TimelineDisplayEntry;
  isLast: boolean;
}

function ReadOnlyTimelineEntry({ entry, isLast }: ReadOnlyTimelineEntryProps) {
  return (
    <div className="flex flex-col gap-1">
      {/* Row 1: Circle + meta info */}
      <div className="flex items-center gap-4">
        <div className="size-6 shrink-0 rounded-full border border-gray-200 bg-gray-50" />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs leading-4 text-gray-500">
            {entry.dateRange}
          </span>
          <span className="size-0.5 rounded-full bg-gray-500" />
          <div className="flex items-center gap-2">
            <div className="flex items-center py-0.5">
              {entry.authorAvatarUrl ? (
                <img
                  src={entry.authorAvatarUrl}
                  alt={entry.authorName}
                  className="size-6 rounded-full object-cover"
                />
              ) : entry.authorInitials ? (
                <span className="flex size-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
                  {entry.authorInitials}
                </span>
              ) : (
                <div className="flex size-4 items-center overflow-hidden rounded-full bg-gray-300">
                  <User className="size-4 text-gray-500" />
                </div>
              )}
            </div>
            <span className="text-xs font-medium leading-4 text-gray-600">
              {entry.authorName}
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Line + card */}
      <div className="flex gap-4">
        <div className="flex w-6 shrink-0 items-center justify-center overflow-hidden rounded-full px-[11px]">
          <div
            className={cn("h-full w-px bg-gray-200", isLast && "opacity-0")}
          />
        </div>
        <div className="flex flex-1 flex-col pb-6 pt-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium leading-5 text-gray-900">
                  {entry.title}
                </p>
                {entry.description && (
                  <p className="whitespace-pre-line text-sm leading-5 text-gray-600">
                    {entry.description}
                  </p>
                )}
              </div>

              {/* Document chips */}
              {entry.documents.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {entry.documents.map((doc, idx) => (
                    <a
                      key={`${doc.filename}-${idx}`}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-gray-300 px-2.5 py-1 text-xs leading-5 text-gray-800 transition-colors hover:bg-gray-100"
                    >
                      <Paperclip className="size-4 shrink-0" />
                      {doc.filename}
                      <ExternalLink className="size-3.5 text-gray-500" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReadOnlyTimelineContentProps {
  entries: TimelineDisplayEntry[];
  isLoading: boolean;
  error: string | null;
}

export function ReadOnlyTimelineContent({
  entries,
  isLoading,
  error,
}: ReadOnlyTimelineContentProps) {
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

  return (
    <div className="flex max-w-[720px] flex-col gap-1">
      {entries.map((entry, idx) => (
        <ReadOnlyTimelineEntry
          key={entry.id}
          entry={entry}
          isLast={idx === entries.length - 1}
        />
      ))}
    </div>
  );
}
