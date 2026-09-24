import { Archive, Check, CheckCheck, X } from "lucide-react";

import { CHIP_BASE_CLASS, CHIP_TONE_CLASS, type ChipTone } from "@/lib/glass";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: "active" | "inactive" | "completed" | "archived";
  className?: string;
};

const statusConfig: Record<
  StatusBadgeProps["status"],
  { label: string; icon: typeof Check; tone: ChipTone }
> = {
  active: { label: "Active", icon: Check, tone: "brand" },
  inactive: { label: "Inactive", icon: X, tone: "danger" },
  completed: { label: "Completed", icon: CheckCheck, tone: "info" },
  archived: { label: "Archived", icon: Archive, tone: "neutral" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(CHIP_BASE_CLASS, CHIP_TONE_CLASS[config.tone], className)}
    >
      <Icon aria-hidden />
      {config.label}
    </span>
  );
}
