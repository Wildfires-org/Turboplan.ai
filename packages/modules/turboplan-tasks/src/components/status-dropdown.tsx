import React from "react";

import { Check } from "lucide-react";

import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";

import { TaskStatus } from "../types";
import { getStatusText } from "../utils";
import { getStatusTone } from "./status-chip";

const StatusOptionIcon = ({ status }: { status: TaskStatus }) => {
  const { icon: Icon, className } = getStatusTone(status);
  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-full ring-1 ring-inset [&_svg]:size-3",
        className,
      )}
    >
      <Icon aria-hidden />
    </span>
  );
};

// Draft is the pre-initiation state and is not offered as a manual target.
const SELECTABLE_STATUSES = [
  TaskStatus.NOT_STARTED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.COMPLETED,
  TaskStatus.DELAYED,
];

interface StatusDropdownProps {
  status: TaskStatus | string;
  onStatusChange: (status: TaskStatus) => void;
  /** The trigger element (rendered via asChild) */
  children: React.ReactNode;
}

export const StatusDropdown: React.FC<StatusDropdownProps> = ({
  status,
  onStatusChange,
  children,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {SELECTABLE_STATUSES.map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(option);
            }}
            className={cn(
              "flex items-center gap-2 text-sm",
              option === status && "font-medium text-brand-900",
            )}
          >
            <StatusOptionIcon status={option} />
            <span className="flex-1">{getStatusText(option)}</span>
            {option === status && (
              <Check aria-hidden className="size-4 text-brand-800" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
