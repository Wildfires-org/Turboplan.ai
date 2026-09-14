import React from "react";

import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";

import { TaskStatus } from "../types";
import { getStatusIcon, getStatusText } from "../utils";

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
              option === status && "bg-gray-100 dark:bg-gray-800",
            )}
          >
            <span>{getStatusIcon(option)}</span>
            <span>{getStatusText(option)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
