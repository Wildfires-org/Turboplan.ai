import React from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "@wildfires-org/turboplan-utils";

import { TaskStatus } from "../../types";
import { getStatusIcon, getStatusText } from "../../utils";
import { StatusDropdown } from "../status-dropdown";
import { type StatusButtonProps } from "./types";

export const StatusButton: React.FC<StatusButtonProps> = ({
  status,
  onStatusChange,
  isReadOnly = false,
}) => {
  const text = getStatusText(status);
  const icon = getStatusIcon(status);

  // In read-only mode, always render as plain text
  // For DRAFT status, show "Not Started" instead of "Initiate" (which is an action label)
  if (isReadOnly) {
    const displayText = status === TaskStatus.DRAFT ? "Not Started" : text;
    const displayIcon = status === TaskStatus.DRAFT ? "⭕" : icon;

    return (
      <div className="text-xs text-gray-700 dark:text-gray-300 inline-flex items-center whitespace-nowrap">
        <span className="mr-1">{displayIcon}</span>
        <span>{displayText}</span>
      </div>
    );
  }

  const isDraft = status === TaskStatus.DRAFT;

  return (
    <StatusDropdown status={status} onStatusChange={(s) => onStatusChange?.(s)}>
      <button
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "px-2.5 py-1 h-7 text-xs rounded-md inline-flex items-center gap-1 whitespace-nowrap transition-colors",
          isDraft
            ? "bg-black hover:bg-gray-800 text-white"
            : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300",
        )}
      >
        <span>{icon}</span>
        <span>{text}</span>
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
    </StatusDropdown>
  );
};
