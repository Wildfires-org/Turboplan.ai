"use client";

import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface Suggestion {
  label: string;
  content: string;
  emoji?: string;
}

interface SuggestionPillsProps {
  suggestions: Suggestion[];
  isLoading?: boolean;
  disabled?: boolean;
  onSuggestionClick?: (content: string) => void;
}

export const SuggestionPills = ({
  suggestions,
  isLoading = false,
  disabled = false,
  onSuggestionClick,
}: SuggestionPillsProps) => {
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-muted p-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-8 w-40 shrink-0 animate-pulse rounded-[10px] border border-border bg-background"
          />
        ))}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={
        disabled
          ? "flex items-center rounded-xl border border-white bg-white shadow-sm"
          : "flex items-center rounded-xl bg-muted"
      }
    >
      {disabled && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          Complete project setup to unlock AI suggestions
        </p>
      )}

      {!disabled && (
        <>
          <div className="relative min-w-0 flex-1">
            <div className="flex gap-2 overflow-x-clip p-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => onSuggestionClick?.(suggestion.content)}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-gray-50 cursor-pointer"
                >
                  {suggestion.emoji && (
                    <span className="shrink-0 text-sm">{suggestion.emoji}</span>
                  )}
                  {suggestion.label}
                </button>
              ))}
            </div>
            <div
              className="pointer-events-none absolute right-0 top-0 h-full w-[30px]"
              style={{
                background:
                  "linear-gradient(90deg, rgba(244, 244, 245, 0) 0%, rgb(244, 245, 246) 100%)",
              }}
            />
          </div>

          <div className="shrink-0 pr-2">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-gray-50 cursor-pointer"
                >
                  All
                  <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {suggestions.length}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="top"
                sideOffset={8}
                className="w-80 max-h-64 overflow-y-auto p-2"
              >
                <div className="flex flex-col gap-1">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => {
                        onSuggestionClick?.(suggestion.content);
                        setPopoverOpen(false);
                      }}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted cursor-pointer"
                    >
                      {suggestion.emoji && (
                        <span className="shrink-0 text-sm">
                          {suggestion.emoji}
                        </span>
                      )}
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}
    </div>
  );
};
