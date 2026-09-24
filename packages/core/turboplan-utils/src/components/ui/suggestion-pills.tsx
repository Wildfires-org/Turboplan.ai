"use client";

import { useState } from "react";

import { cn } from "../../tailwind";
import { GLASS_CLASS, GLASS_MENU_ITEM_CLASS } from "./glass-classes";
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

// Glass pill with press feedback (landing `press`: scale .97, strong ease-out,
// off for reduced motion) and an outline focus ring (the glass owns the
// box-shadow a ring would replace).
const PILL_CLASS = cn(
  GLASS_CLASS,
  "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium text-slate-900 transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white/90 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 motion-reduce:active:scale-100 dark:text-white dark:hover:bg-white/10",
);

export const SuggestionPills = ({
  suggestions,
  isLoading = false,
  disabled = false,
  onSuggestionClick,
}: SuggestionPillsProps) => {
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (isLoading) {
    return (
      <div aria-hidden className="flex items-center gap-2 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              GLASS_CLASS,
              "h-8 w-40 shrink-0 animate-pulse rounded-full motion-reduce:animate-none",
            )}
          />
        ))}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  if (disabled) {
    return (
      <div className={cn(GLASS_CLASS, "flex items-center rounded-xl")}>
        <p className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          Complete project setup to unlock AI suggestions
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Row fades out on the right with a mask, so it blends into whatever
          surface it sits on. */}
      <div className="flex min-w-0 flex-1 gap-2 -my-1 -ml-1 overflow-x-clip px-1 py-1 [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            onClick={() => onSuggestionClick?.(suggestion.content)}
            className={PILL_CLASS}
          >
            {suggestion.emoji && (
              <span aria-hidden className="shrink-0 text-sm">
                {suggestion.emoji}
              </span>
            )}
            {suggestion.label}
          </button>
        ))}
      </div>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(PILL_CLASS, "px-3 data-[state=open]:bg-white/90")}
          >
            All
            <span className="flex size-5 items-center justify-center rounded-full bg-brand-50 text-[11px] font-medium text-brand-900 ring-1 ring-inset ring-brand-800/15">
              {suggestions.length}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={8}
          className="max-h-64 w-80 overflow-y-auto p-1.5"
        >
          <div className="flex flex-col gap-0.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => {
                  onSuggestionClick?.(suggestion.content);
                  setPopoverOpen(false);
                }}
                className={cn(
                  GLASS_MENU_ITEM_CLASS,
                  "flex cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-slate-900 transition-colors hover:bg-brandAlt-100 hover:text-brand-900 focus-visible:outline-none dark:text-white dark:hover:bg-white/10",
                )}
              >
                {suggestion.emoji && (
                  <span aria-hidden className="shrink-0 text-sm">
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
  );
};
