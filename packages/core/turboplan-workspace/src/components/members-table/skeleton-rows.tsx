"use client";

import { cn } from "@wildfires-org/turboplan-utils";

interface SkeletonRowsProps {
  showSubEntityColumn: boolean;
}

// Mirrors MemberRowItem's box model exactly (px-6 py-3, 32px avatar, two text
// lines, 36px role control) so rows don't jump when data lands.
const BAR_CLASS =
  "rounded-md bg-brandAlt-200/70 animate-pulse motion-reduce:animate-none";

export function SkeletonRows({ showSubEntityColumn }: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          className="flex items-center gap-4 border-t border-slate-900/[0.06] px-6 py-3 first:border-t-0 dark:border-white/10"
        >
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className={cn(BAR_CLASS, "size-8 rounded-lg")} />
            <div className="flex flex-col">
              <span className="flex h-5 items-center">
                <span className={cn(BAR_CLASS, "h-3.5 w-32")} />
              </span>
              <span className="flex h-4 items-center">
                <span className={cn(BAR_CLASS, "h-3 w-44")} />
              </span>
            </div>
          </div>
          {showSubEntityColumn && (
            <div className="w-[200px] flex gap-1.5">
              <div className={cn(BAR_CLASS, "h-5 w-20 rounded")} />
              <div className={cn(BAR_CLASS, "h-5 w-16 rounded")} />
            </div>
          )}
          <div className="w-[120px]">
            <div className={cn(BAR_CLASS, "h-5 w-16")} />
          </div>
          <div className="w-[100px]">
            <div className={cn(BAR_CLASS, "size-4 rounded-full")} />
          </div>
          <div className="w-[60px]" />
        </div>
      ))}
    </>
  );
}
