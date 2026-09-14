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
    <div>
      <div role="tablist" className="flex gap-1">
        <button
          type="button"
          role="tab"
          aria-selected={!hasExistingProject}
          onClick={() => onModeChange(false)}
          disabled={disabled}
          className={cn(
            "relative -mb-px rounded-t-lg border border-gray-200 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            hasExistingProject
              ? "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              : "z-10 border-b-transparent bg-white text-gray-900",
          )}
        >
          Starting from scratch
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={hasExistingProject}
          onClick={() => onModeChange(true)}
          disabled={disabled}
          className={cn(
            "relative -mb-px rounded-t-lg border border-gray-200 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            hasExistingProject
              ? "z-10 border-b-transparent bg-white text-gray-900"
              : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700",
          )}
        >
          Already in progress
        </button>
      </div>

      {/* Content panel — connects seamlessly to the active tab */}
      <div
        role="tabpanel"
        className="relative space-y-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <p className="text-xs text-gray-500">
          {hasExistingProject
            ? "Project already underway? Upload your documents and the AI will learn your project from them."
            : "Describe your project and our AI will research and bootstrap your workspace."}
        </p>

        {children}
      </div>
    </div>
  );
}
