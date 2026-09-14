import { Check, Circle, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type SubmissionStatus = "new" | "approved" | "rejected";

type SubmissionStatusBadgeProps = {
  status: SubmissionStatus;
  className?: string;
};

const statusConfig = {
  new: {
    label: "New",
    icon: Circle,
    classes: "bg-blue-50 border-blue-100 text-blue-500",
    iconClasses: "size-1.5 fill-current",
  },
  approved: {
    label: "Approved",
    icon: Check,
    classes: "bg-emerald-50 border-emerald-100 text-emerald-500",
    iconClasses: "size-3",
  },
  rejected: {
    label: "Rejected",
    icon: X,
    classes: "bg-red-50 border-red-100 text-red-500",
    iconClasses: "size-3",
  },
};

export function SubmissionStatusBadge({
  status,
  className,
}: SubmissionStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5",
        config.classes,
        className,
      )}
    >
      <Icon className={config.iconClasses} />
      <span className="text-[11px] font-medium leading-[16.5px] tracking-[0.065px]">
        {config.label}
      </span>
    </div>
  );
}
