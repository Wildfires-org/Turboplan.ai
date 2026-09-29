"use client";

import type { ReactNode } from "react";

import { cn } from "@wildfires-org/turboplan-utils";

interface ModeTabsProps {
  hasExistingProject: boolean;
  disabled: boolean;
  onModeChange: (hasExistingProject: boolean) => void;
  children: ReactNode;
}

export function ModeTabs({
  hasExistingProject,
  disabled,
  onModeChange,
  children,
}: ModeTabsProps) {
  return (
    <div className="space-y-3">
      {/* Segmented glass control */}
      <div
        role="tablist"
        aria-label="Project stage"
        className="flex w-full gap-1 rounded-full bg-brandAlt-100 p-1 ring-1 ring-inset ring-brandAlt-200/70 dark:bg-white/5 dark:ring-white/10"
      >
        <ModeTab
          selected={!hasExistingProject}
          disabled={disabled}
          onSelect={() => onModeChange(false)}
        >
          Starting from scratch
        </ModeTab>
        <ModeTab
          selected={hasExistingProject}
          disabled={disabled}
          onSelect={() => onModeChange(true)}
        >
          Already in progress
        </ModeTab>
      </div>

      <div role="tabpanel" className="space-y-4">
        <p className="text-xs text-gray-550">
          {hasExistingProject
            ? "Project already underway? Upload your documents and the AI will learn your project from them."
            : "Describe your project and our AI will research and bootstrap your workspace."}
        </p>

        {children}
      </div>
    </div>
  );
}

interface ModeTabProps {
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  children: ReactNode;
}

const ModeTab = ({ selected, disabled, onSelect, children }: ModeTabProps) => (
  <button
    type="button"
    role="tab"
    aria-selected={selected}
    onClick={onSelect}
    disabled={disabled}
    className={cn(
      "press h-9 flex-1 whitespace-nowrap rounded-full px-2 text-[13px] font-medium sm:px-4 sm:text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed",
      selected
        ? "bg-white text-brand-800 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_4px_12px_-6px_rgba(21,102,71,0.25),inset_0_1px_0_#fff] dark:bg-white/15 dark:text-white"
        : "text-gray-550 hover:bg-white/60 hover:text-foreground",
    )}
  >
    {children}
  </button>
);
