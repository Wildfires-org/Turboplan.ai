import React from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "@wildfires-org/turboplan-utils";

import { TaskStatus } from "../../types";
import { getStatusText } from "../../utils";
import {
  getStatusTone,
  STATUS_CHIP_BASE_CLASS,
  StatusChip,
} from "../status-chip";
import { StatusDropdown } from "../status-dropdown";
import { type StatusButtonProps } from "./types";

export const StatusButton: React.FC<StatusButtonProps> = ({
  status,
  onStatusChange,
  isReadOnly = false,
}) => {
  // In read-only mode render a plain chip. A DRAFT reads "Not Started"
  // there ("Initiate" is an action label).
  if (isReadOnly) {
    const isDraft = status === TaskStatus.DRAFT;
    return (
      <StatusChip
        status={isDraft ? TaskStatus.NOT_STARTED : status}
        label={isDraft ? "Not Started" : undefined}
      />
    );
  }

  const { icon: Icon, className: toneClass } = getStatusTone(status);

  return (
    <StatusDropdown status={status} onStatusChange={(s) => onStatusChange?.(s)}>
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          STATUS_CHIP_BASE_CLASS,
          toneClass,
          "transition-[filter,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:brightness-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 active:scale-[0.97] data-[state=open]:brightness-[0.95] motion-reduce:active:scale-100",
        )}
      >
        <Icon aria-hidden />
        <span>{getStatusText(status)}</span>
        <ChevronDown aria-hidden className="!size-3 opacity-70" />
      </button>
    </StatusDropdown>
  );
};
