import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: "active" | "inactive" | "completed" | "archived";
  className?: string;
};

const statusConfig = {
  active: {
    label: "Active",
    icon: Check,
    classes: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  inactive: {
    label: "Inactive",
    icon: X,
    classes: "bg-red-50 border-red-100 text-red-700",
  },
  completed: {
    label: "Completed",
    icon: Check,
    classes: "bg-blue-50 border-blue-200 text-blue-700",
  },
  archived: {
    label: "Archived",
    icon: X,
    classes: "bg-gray-50 border-gray-100 text-gray-600",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
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
      <Icon className="size-3.5" />
      <span className="text-[10px] leading-4">{config.label}</span>
    </div>
  );
}
