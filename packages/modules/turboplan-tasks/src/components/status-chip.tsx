import React from "react";

import {
  AlarmClock,
  CheckCircle2,
  Circle,
  CircleDot,
  type LucideIcon,
  Zap,
} from "lucide-react";

import { cn } from "@wildfires-org/turboplan-utils";

import { TaskStatus } from "../types";
import { getStatusText } from "../utils";

interface StatusTone {
  icon: LucideIcon;
  /** Tinted chip: text >= 4.5:1 on its own fill at 12px. */
  className: string;
}

const STATUS_TONES: Record<string, StatusTone> = {
  [TaskStatus.DRAFT]: {
    icon: Zap,
    className: "bg-slate-900 text-white ring-slate-900 hover:bg-slate-800",
  },
  [TaskStatus.NOT_STARTED]: {
    icon: Circle,
    className:
      "bg-slate-900/[0.04] text-gray-700 ring-slate-900/[0.08] dark:bg-white/10 dark:text-slate-200",
  },
  [TaskStatus.IN_PROGRESS]: {
    icon: CircleDot,
    className:
      "bg-blue-50 text-blue-700 ring-blue-700/15 dark:bg-blue-500/15 dark:text-blue-200",
  },
  [TaskStatus.COMPLETED]: {
    icon: CheckCircle2,
    className:
      "bg-brand-50 text-brand-900 ring-brand-800/15 dark:bg-brand-500/15 dark:text-brand-200",
  },
  [TaskStatus.DELAYED]: {
    icon: AlarmClock,
    className:
      "bg-amber-50 text-amber-800 ring-amber-800/15 dark:bg-amber-500/15 dark:text-amber-200",
  },
};

export const getStatusTone = (status: TaskStatus | string): StatusTone =>
  STATUS_TONES[status] ?? STATUS_TONES[TaskStatus.NOT_STARTED];

/** Base chip geometry shared by the read-only chip and the status trigger. */
export const STATUS_CHIP_BASE_CLASS =
  "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset [&_svg]:size-3.5 [&_svg]:shrink-0";

interface StatusChipProps {
  status: TaskStatus | string;
  /** Override the label (e.g. "Not Started" for a read-only draft). */
  label?: string;
  className?: string;
  children?: React.ReactNode;
}

/** Read-only status chip: lucide icon + label on a tinted fill. */
export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  className,
  children,
}) => {
  const { icon: Icon, className: toneClass } = getStatusTone(status);
  return (
    <span className={cn(STATUS_CHIP_BASE_CLASS, toneClass, className)}>
      <Icon aria-hidden />
      {label ?? getStatusText(status)}
      {children}
    </span>
  );
};
