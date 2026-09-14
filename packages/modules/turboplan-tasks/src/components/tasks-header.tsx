/**
 * Pure Tasks Header Component
 * Only handles rendering - receives state and callbacks as props
 */

import React, { useEffect } from "react";

import type { TasksHeaderProps } from "../types";
import { SearchControls, SearchInfoBanner } from "./search-bar";

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
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <button
                onClick={() => onActiveTabChange("gantt")}
                className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                  activeTab === "gantt"
                    ? "text-orange-500 border-orange-500"
                    : "text-gray-600 hover:text-gray-900 border-transparent"
                }`}
              >
                Gantt view
              </button>
              <button
                onClick={() => onActiveTabChange("card")}
                className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                  activeTab === "card"
                    ? "text-orange-500 border-orange-500"
                    : "text-gray-600 hover:text-gray-900 border-transparent"
                }`}
              >
                Card view
              </button>
            </div>

            {/* Preview Mode Indicator */}
            {!isCurrentVersion && (
              <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-full text-sm">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
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
