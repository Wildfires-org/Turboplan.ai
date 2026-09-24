/**
 * Pure Tasks Header Component
 * Only handles rendering - receives state and callbacks as props
 */

import React, { useEffect } from "react";

import { cn, GLASS_CLASS } from "@wildfires-org/turboplan-utils";

import type { TasksHeaderProps } from "../types";
import { SearchControls, SearchInfoBanner } from "./search-bar";

const VIEW_TABS = [
  { id: "gantt", label: "Gantt view" },
  { id: "card", label: "Card view" },
] as const;

const SEGMENT_CLASS =
  "inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 motion-reduce:active:scale-100";

// Active = white pill with a top highlight (landing segmented control).
const SEGMENT_ACTIVE_CLASS =
  "bg-white text-brand-800 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_4px_12px_-6px_rgba(21,102,71,0.25),inset_0_1px_0_#fff] dark:bg-white/15 dark:text-white";

const SEGMENT_INACTIVE_CLASS =
  "text-gray-600 hover:bg-white/60 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-white/10";

export const TasksHeader: React.FC<TasksHeaderProps> = ({
  searchQuery,
  activeTab,
  filterMode,
  ganttViewMode,
  filteredMilestones,
  isCurrentVersion = true,
  onActiveTabChange = () => {},
  onSearchQueryChange = () => {},
  onFilterModeChange = () => {},
  onGanttViewModeChange = () => {},
  onClearSearch = () => {},
  onShowAll = () => {},
}) => {
  // Force layout recalculation when switching to Gantt view
  useEffect(() => {
    if (activeTab === "gantt") {
      const timeoutId = setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [activeTab]);

  return (
    <>
      {/* Header with tabs and controls */}
      <div className="flex items-center justify-between border-b border-slate-900/[0.06] p-4 dark:border-white/10">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            {/* Segmented glass view switcher */}
            <div
              role="tablist"
              aria-label="Task views"
              className={cn(
                GLASS_CLASS,
                "flex items-center gap-1 rounded-full p-1",
              )}
            >
              {VIEW_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => onActiveTabChange(tab.id)}
                  className={cn(
                    SEGMENT_CLASS,
                    activeTab === tab.id
                      ? SEGMENT_ACTIVE_CLASS
                      : SEGMENT_INACTIVE_CLASS,
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Preview Mode Indicator */}
            {!isCurrentVersion && (
              <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900 ring-1 ring-inset ring-amber-800/15 dark:bg-amber-900/20 dark:text-amber-200">
                <div className="size-2 rounded-full bg-amber-500"></div>
                <span>Preview Mode</span>
              </div>
            )}
          </div>

          {activeTab === "gantt" ? (
            <SearchControls
              searchQuery={searchQuery}
              filterMode={filterMode}
              onSearchChange={onSearchQueryChange}
              onFilterModeChange={onFilterModeChange}
              onClearSearch={onClearSearch}
              showViewModeSelector={true}
              viewMode={ganttViewMode}
              onViewModeChange={onGanttViewModeChange}
            />
          ) : (
            <SearchControls
              searchQuery={searchQuery}
              filterMode={filterMode}
              onSearchChange={onSearchQueryChange}
              onFilterModeChange={onFilterModeChange}
              onClearSearch={onClearSearch}
              showViewModeSelector={false}
            />
          )}
        </div>
      </div>

      {/* Search Info Banner */}
      <div className="px-4">
        <SearchInfoBanner
          searchQuery={searchQuery}
          filterMode={filterMode}
          filteredMilestones={filteredMilestones}
          onClearSearch={onClearSearch}
          onShowAll={onShowAll}
        />
      </div>
    </>
  );
};
