"use client";

import { type ReactNode, useId } from "react";

import { Building2, FolderOpen } from "lucide-react";

import type { ContextUploadTarget } from "@/lib/context-upload-target";
import {
  SEGMENT_ACTIVE_CLASS,
  SEGMENT_CLASS,
  SEGMENT_INACTIVE_CLASS,
  SEGMENTED_TRACK_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

interface ContextUploadTargetSwitchProps {
  value: ContextUploadTarget;
  organizationName: string;
  onChange: (target: ContextUploadTarget) => void;
}

interface SegmentProps {
  isActive: boolean;
  onSelect: () => void;
  children: ReactNode;
}

/**
 * "Add files to: [Project] [Organization]" above the project Context
 * dropzone, with a line saying who will see the files.
 */
export const ContextUploadTargetSwitch = ({
  value,
  organizationName,
  onChange,
}: ContextUploadTargetSwitchProps) => {
  const labelId = useId();

  return (
    <div className="space-y-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <span id={labelId} className="text-[13px] leading-5 text-gray-550">
          Add files to:
        </span>
        <div
          role="group"
          aria-labelledby={labelId}
          className={cn(SEGMENTED_TRACK_CLASS, "min-w-0")}
        >
          <Segment
            isActive={value === "project"}
            onSelect={() => onChange("project")}
          >
            <FolderOpen aria-hidden />
            Project
          </Segment>
          <Segment
            isActive={value === "organization"}
            onSelect={() => onChange("organization")}
          >
            <Building2 aria-hidden />
            <span className="max-w-[12rem] truncate">{organizationName}</span>
          </Segment>
        </div>
      </div>
      <p className="text-xs leading-5 text-gray-550 [overflow-wrap:anywhere]">
        {value === "project"
          ? "Only this project's chats and research use these files."
          : `Shared with the AI in every project in ${organizationName}.`}
      </p>
    </div>
  );
};

const Segment = ({ isActive, onSelect, children }: SegmentProps) => (
  <button
    type="button"
    aria-pressed={isActive}
    onClick={onSelect}
    className={cn(
      SEGMENT_CLASS,
      isActive ? SEGMENT_ACTIVE_CLASS : SEGMENT_INACTIVE_CLASS,
    )}
  >
    {children}
  </button>
);
