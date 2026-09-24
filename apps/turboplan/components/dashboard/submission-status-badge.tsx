import { Check, Circle, X } from "lucide-react";

import { CHIP_BASE_CLASS, CHIP_TONE_CLASS, type ChipTone } from "@/lib/glass";
import { cn } from "@/lib/utils";

export type SubmissionStatus = "new" | "approved" | "rejected";

type SubmissionStatusBadgeProps = {
  status: SubmissionStatus;
  className?: string;
};

const statusConfig: Record<
  SubmissionStatus,
  { label: string; icon: typeof Check; tone: ChipTone; iconClasses?: string }
> = {
  new: {
    label: "New",
    icon: Circle,
    tone: "info",
    iconClasses: "!size-1.5 fill-current",
  },
  approved: { label: "Approved", icon: Check, tone: "brand" },
  rejected: { label: "Rejected", icon: X, tone: "danger" },
};

export function SubmissionStatusBadge({
  status,
  className,
}: SubmissionStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(CHIP_BASE_CLASS, CHIP_TONE_CLASS[config.tone], className)}
    >
      <Icon aria-hidden className={config.iconClasses} />
      {config.label}
    </span>
  );
}
