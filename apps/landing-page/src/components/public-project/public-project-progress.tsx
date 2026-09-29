"use client";

import { format } from "date-fns";

import { calculateProgress } from "@wildfires-org/turboplan-utils";

import { cn } from "@/lib/utils";

interface PublicProjectProgressProps {
  startDate: string | null;
  endDate: string | null;
  className?: string;
}

// Client component: the shared utils entry is "use client", so its helpers
// cannot be called from a server component.
// Schedule progress for the header shell. Reuses the shared
// `calculateProgress` so numbers match the app's ProjectProgress, with a
// layout that stacks on narrow screens.
export function PublicProjectProgress({
  startDate,
  endDate,
  className,
}: PublicProjectProgressProps) {
  const progress = calculateProgress(startDate, endDate);

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
    <div
      className={cn(
        "glass-inset rounded-2xl px-4 py-4 text-left sm:px-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 font-inter text-[14px] leading-[20px]">
        <span className="font-medium text-egray-900">Progress</span>
        <span className={isOverdue ? "text-error-700" : "text-egray-700"}>
          {daysElapsed}/{totalDays} days
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Project schedule progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
        className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-brandAlt-200/70"
      >
        <div
          className={cn(
            "h-full rounded-full",
            isOverdue ? "bg-error-600" : "bg-brand-600",
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-inter text-[13px] leading-[18px]">
        <span
          className={cn(
            "font-medium",
            isOverdue ? "text-error-700" : "text-brand-800",
          )}
        >
          {isOverdue
            ? `${Math.abs(daysLeft)} days overdue`
            : `${daysLeft} days left`}
        </span>
        <span className="text-egray-700">
          Due {format(dueDate, "MMMM d, yyyy")}
        </span>
      </div>
    </div>
  );
}
