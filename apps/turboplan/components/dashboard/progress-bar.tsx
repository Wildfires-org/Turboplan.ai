import { cn } from "@/lib/utils";

type ProgressBarProps = {
  percentage: number;
  className?: string;
};

export function ProgressBar({ percentage, className }: ProgressBarProps) {
  const clampedPercentage = Math.round(Math.min(100, Math.max(0, percentage)));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clampedPercentage}
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-brandAlt-200"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand-700"
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
      <span className="text-[11px] font-medium leading-4 tabular-nums text-gray-550">
        {clampedPercentage}%
      </span>
    </div>
  );
}
