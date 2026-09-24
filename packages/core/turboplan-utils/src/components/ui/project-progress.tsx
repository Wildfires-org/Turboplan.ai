"use client";

import { useMemo } from "react";

import { differenceInDays, format } from "date-fns";

import { cn } from "../../tailwind";

interface ProjectProgressProps {
  /** Project start date */
  startDate: Date | string | null;
  /** Project end date */
  endDate: Date | string | null;
  /** Optional actions to render in the header (e.g., visibility toggle) */
  renderActions?: () => React.ReactNode;
  /** Optional class name for the container */
  className?: string;
}

export interface ProgressData {
  daysElapsed: number;
  totalDays: number;
  daysLeft: number;
  progressPercent: number;
  isOverdue: boolean;
  dueDate: Date;
}

export function calculateProgress(
  startDate: Date | string | null,
  endDate: Date | string | null,
): ProgressData | null {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();

  // Reset time to compare dates only
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const totalDays = differenceInDays(end, start);
  const daysElapsed = differenceInDays(today, start);
  const daysLeft = differenceInDays(end, today);

  // Handle edge case where total days is 0 or negative
  if (totalDays <= 0) {
    return null;
  }

  // Calculate progress percentage (capped at 100%)
  const progressPercent = Math.min(
    100,
    Math.max(0, (daysElapsed / totalDays) * 100),
  );

  return {
    daysElapsed: Math.max(0, daysElapsed),
    totalDays,
    daysLeft,
    progressPercent,
    isOverdue: daysLeft < 0,
    dueDate: end,
  };
}

export function ProjectProgress({
  startDate,
  endDate,
  renderActions,
  className,
}: ProjectProgressProps) {
  const progress = useMemo(
    () => calculateProgress(startDate, endDate),
    [startDate, endDate],
  );

  // Don't render if we don't have valid date data
  if (!progress) {
    return null;
  }

  const {
    daysElapsed,
    totalDays,
    daysLeft,
    progressPercent,
    isOverdue,
    dueDate,
  } = progress;

  return (
    <div className={cn("flex w-full items-center gap-4 sm:gap-16", className)}>
      {/* Progress bar with days-left + due date beside it (not full width) */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end sm:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:pb-1">
          <div className="flex w-full items-center justify-between gap-4 whitespace-nowrap">
            <span className="text-sm text-neutral-900/60">Progress</span>
            <span
              className={cn(
                "text-xs",
                isOverdue ? "text-error-600" : "text-neutral-900/60",
              )}
            >
              {daysElapsed}/{totalDays} days
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-white">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isOverdue ? "bg-error-600" : "bg-brandAlt-400",
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-[18px] whitespace-nowrap text-xs tabular-nums sm:pb-1">
          <span
            className={cn(
              isOverdue
                ? "font-medium text-error-600"
                : "font-semibold text-neutral-900/60",
            )}
          >
            {isOverdue
              ? `${Math.abs(daysLeft)} days overdue`
              : `${daysLeft} days left`}
          </span>
          <span className="text-neutral-900/60">
            due: {format(dueDate, "MMMM d, yyyy")}
          </span>
        </div>
      </div>

      {renderActions?.()}
    </div>
  );
}
