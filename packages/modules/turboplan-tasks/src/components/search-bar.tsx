import React, { useRef, useState } from "react";

import { Calendar, ChevronDown, FilterIcon, Search } from "lucide-react";
import { useOnClickOutside } from "usehooks-ts";

import type { MilestoneWithTasks, ViewMode } from "../types";

interface SearchBarProps {
  searchQuery: string;
  filterMode: "all" | "hideCompleted";
  filteredMilestones: MilestoneWithTasks[];
  onSearchChange: (query: string) => void;
  onFilterModeChange: (mode: "all" | "hideCompleted") => void;
  onClearSearch: () => void;
  onShowAll: () => void;
}

// Use discriminated union for better type safety with ViewMode props
type SearchControlsProps = {
  searchQuery: string;
  filterMode: "all" | "hideCompleted";
  onSearchChange: (query: string) => void;
  onFilterModeChange: (mode: "all" | "hideCompleted") => void;
  onClearSearch: () => void;
} & (
  | {
      showViewModeSelector: true;
      viewMode: ViewMode;
      onViewModeChange: (mode: ViewMode) => void;
    }
  | {
      showViewModeSelector?: false;
      viewMode?: never;
      onViewModeChange?: never;
    }
);

interface SearchInfoBannerProps {
  searchQuery: string;
  filterMode: "all" | "hideCompleted";
  filteredMilestones: MilestoneWithTasks[];
  onClearSearch: () => void;
  onShowAll: () => void;
}

interface ViewModeSelectorProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  disabled?: boolean;
}

const ViewModeSelector: React.FC<ViewModeSelectorProps> = ({
  viewMode,
  onViewModeChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(
    null,
  ) as React.RefObject<HTMLDivElement>;

  const modes: ViewMode[] = ["Day", "Week", "Month", "Year"];

  // Close dropdown when clicking outside
  useOnClickOutside(dropdownRef, () => setIsOpen(false));

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setIsOpen(false);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen(!isOpen);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = modes.indexOf(viewMode);
        const nextIndex =
          event.key === "ArrowDown"
            ? (currentIndex + 1) % modes.length
            : (currentIndex - 1 + modes.length) % modes.length;
        onViewModeChange(modes[nextIndex]);
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`h-8 px-3 inline-flex items-center gap-2 rounded-md border transition-colors ${
          disabled
            ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Calendar className="h-4 w-4" />
        {viewMode}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 min-w-full">
          {modes.map((mode) => (
            <button
              key={mode}
              onClick={() => {
                onViewModeChange(mode);
                setIsOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                mode === viewMode
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              role="option"
              aria-selected={mode === viewMode}
            >
              {mode}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const SearchControls: React.FC<SearchControlsProps> = ({
  searchQuery,
  filterMode,
  onSearchChange,
  onFilterModeChange,
  onClearSearch,
  showViewModeSelector = false,
  viewMode = "Month",
  onViewModeChange,
}) => {
  return (
    <div className="flex items-center gap-3">
      {/* Proper ViewMode Dropdown with accessibility features */}
      {showViewModeSelector && onViewModeChange && (
        <ViewModeSelector
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
      )}

      {/* Simple Filter Button - temporarily simplified */}
      <button
        onClick={() => {
          onFilterModeChange(filterMode === "all" ? "hideCompleted" : "all");
        }}
        className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors ${
          filterMode === "hideCompleted"
            ? "text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40"
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
        title={filterMode === "all" ? "Hide completed items" : "Show all items"}
      >
        <FilterIcon className="h-4 w-4" />
      </button>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-3 h-8 w-48 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchQuery && (
          <button
            onClick={onClearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export const SearchInfoBanner: React.FC<SearchInfoBannerProps> = ({
  searchQuery,
  filterMode,
  filteredMilestones,
  onClearSearch,
  onShowAll,
}) => {
  const hasActiveFilters = searchQuery || filterMode === "hideCompleted";
  const totalTasks = filteredMilestones.reduce(
    (acc: number, m: MilestoneWithTasks) => acc + m.tasks.length,
    0,
  );

  if (!hasActiveFilters) {
    return null;
  }

  return (
    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between">
        <div className="text-sm text-blue-700 dark:text-blue-300">
          {filteredMilestones.length === 0 ? (
            <>
              No results found
              {searchQuery && <> for "{searchQuery}"</>}
              {filterMode === "hideCompleted" && <> (hiding completed)</>}
            </>
          ) : (
            <>
              Found {filteredMilestones.length} milestone
              {filteredMilestones.length !== 1 ? "s" : ""}
              {totalTasks > 0 && (
                <>
                  {" "}
                  and {totalTasks} task{totalTasks !== 1 ? "s" : ""}
                </>
              )}
              {searchQuery && <> matching "{searchQuery}"</>}
              {filterMode === "hideCompleted" && <> (hiding completed)</>}
            </>
          )}
        </div>
        <div className="flex gap-2">
          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
            >
              Clear search
            </button>
          )}
          {filterMode === "hideCompleted" && (
            <button
              onClick={onShowAll}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
            >
              Show all
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Keep the original SearchBar component for backward compatibility
export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  filterMode,
  filteredMilestones,
  onSearchChange,
  onFilterModeChange,
  onClearSearch,
  onShowAll,
}) => {
  return (
    <div className="space-y-4">
      <SearchControls
        searchQuery={searchQuery}
        filterMode={filterMode}
        onSearchChange={onSearchChange}
        onFilterModeChange={onFilterModeChange}
        onClearSearch={onClearSearch}
      />
      <SearchInfoBanner
        searchQuery={searchQuery}
        filterMode={filterMode}
        filteredMilestones={filteredMilestones}
        onClearSearch={onClearSearch}
        onShowAll={onShowAll}
      />
    </div>
  );
};
