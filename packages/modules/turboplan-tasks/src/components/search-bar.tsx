import React, { useRef, useState } from "react";

import { Calendar, ChevronDown, FilterIcon, Search } from "lucide-react";
import { useOnClickOutside } from "usehooks-ts";

import {
  cn,
  GLASS_CLASS,
  GLASS_INSET_CLASS,
  GLASS_POPOVER_CLASS,
} from "@wildfires-org/turboplan-utils";

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
        className={cn(
          GLASS_CLASS,
          "inline-flex h-8 items-center gap-2 rounded-full px-3 text-[13px] text-gray-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:text-slate-200",
          disabled
            ? "cursor-not-allowed opacity-50"
            : "hover:bg-white/80 aria-expanded:bg-white/90 dark:hover:bg-white/10",
        )}
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
        <div
          className={cn(
            GLASS_POPOVER_CLASS,
            "absolute left-0 top-full z-50 mt-1 min-w-full p-1",
          )}
        >
          {modes.map((mode) => (
            <button
              key={mode}
              onClick={() => {
                onViewModeChange(mode);
                setIsOpen(false);
              }}
              className={cn(
                "block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                mode === viewMode
                  ? "bg-brand-50 font-medium text-brand-900 dark:bg-white/10 dark:text-white"
                  : "text-gray-700 hover:bg-brandAlt-100 hover:text-brand-900 dark:text-gray-300 dark:hover:bg-white/10",
              )}
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
        aria-pressed={filterMode === "hideCompleted"}
        aria-label={
          filterMode === "all" ? "Hide completed items" : "Show all items"
        }
        className={cn(
          GLASS_CLASS,
          "inline-flex size-8 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700",
          filterMode === "hideCompleted"
            ? "bg-brand-50 text-brand-800 hover:bg-brand-100 dark:bg-white/15 dark:text-white"
            : "text-gray-600 hover:bg-white/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10",
        )}
        title={filterMode === "all" ? "Hide completed items" : "Show all items"}
      >
        <FilterIcon className="h-4 w-4" />
      </button>

      {/* Search Input */}
      <div className="relative">
        <Search
          aria-hidden
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500"
        />
        <input
          type="text"
          aria-label="Search tasks"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            GLASS_INSET_CLASS,
            "h-8 w-48 rounded-full pl-9 pr-3 text-[13px] text-foreground placeholder:text-gray-500 focus:outline focus:outline-2 focus:outline-brand-700/40",
          )}
        />
        {searchQuery && (
          <button
            onClick={onClearSearch}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
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
    <div className="rounded-xl bg-brand-50 p-3 ring-1 ring-inset ring-brand-800/15 dark:bg-white/10">
      <div className="flex items-center justify-between">
        <div className="text-sm text-brand-900 dark:text-brand-200">
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
              className="text-sm font-medium text-brand-800 hover:text-brand-900 dark:text-brand-300"
            >
              Clear search
            </button>
          )}
          {filterMode === "hideCompleted" && (
            <button
              onClick={onShowAll}
              className="text-sm font-medium text-brand-800 hover:text-brand-900 dark:text-brand-300"
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
