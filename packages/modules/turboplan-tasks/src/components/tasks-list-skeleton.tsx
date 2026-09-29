import React from "react";

import { cn, GLASS_CLASS } from "@wildfires-org/turboplan-utils";

interface TasksListSkeletonProps {
  className?: string;
  /** Include the view-switcher/search header row (TasksHeader metrics). */
  withHeader?: boolean;
  rows?: number;
}

const BAR_CLASS =
  "rounded-md bg-brandAlt-200/70 animate-pulse motion-reduce:animate-none dark:bg-slate-800/70";

/**
 * Placeholder for the tasks module: the header row (segmented view switcher +
 * search controls) and the task table (54px column header, 48px rows) at the
 * loaded component's metrics, so the list lands without moving the page.
 */
export const TasksListSkeleton: React.FC<TasksListSkeletonProps> = ({
  className,
  withHeader = true,
  rows = 6,
}) => (
  <div
    role="status"
    aria-label="Loading tasks"
    className={cn("flex w-full flex-col", className)}
  >
    {withHeader && (
      <div className="flex items-center justify-between gap-3 border-b border-slate-900/[0.06] p-4 dark:border-white/10">
        <div
          className={cn(
            GLASS_CLASS,
            "flex items-center gap-1 rounded-full p-1",
          )}
        >
          <span className="h-8 w-[92px] rounded-full bg-white/90 dark:bg-white/15" />
          <span className="h-8 w-[84px]" />
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <span className={cn(BAR_CLASS, "h-8 w-20 rounded-full")} />
          <span className={cn(BAR_CLASS, "size-8 rounded-full")} />
          <span className={cn(BAR_CLASS, "h-8 w-48 rounded-full")} />
        </div>
      </div>
    )}
    <div className="flex h-[54px] items-center gap-4 px-4">
      <span className={cn(BAR_CLASS, "h-3 w-12")} />
      <span className={cn(BAR_CLASS, "ml-auto h-3 w-16")} />
      <span className={cn(BAR_CLASS, "h-3 w-14")} />
    </div>
    {Array.from({ length: rows }, (_, index) => (
      <div
        key={index}
        className="flex h-12 items-center gap-4 border-t border-slate-900/[0.06] px-4 dark:border-white/10"
      >
        <span
          className={cn(
            BAR_CLASS,
            "h-3",
            index % 3 === 0 ? "w-56" : "ml-4 w-44",
          )}
        />
        <span className={cn(BAR_CLASS, "ml-auto size-6 rounded-full")} />
        <span className={cn(BAR_CLASS, "h-6 w-24 rounded-md")} />
      </div>
    ))}
  </div>
);
