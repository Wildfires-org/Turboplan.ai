import { cn } from "@/lib/utils";

type ProgressBarProps = {
  percentage: number;
  className?: string;
};

export function ProgressBar({ percentage, className }: ProgressBarProps) {
  const clampedPercentage = Math.round(Math.min(100, Math.max(0, percentage)));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-1 flex-1 rounded-full bg-gray-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-400"
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold leading-4 text-gray-500">
        {clampedPercentage}%
      </span>
    </div>
  );
}
