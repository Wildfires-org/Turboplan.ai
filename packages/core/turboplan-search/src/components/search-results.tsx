"use client";

import { AlertCircle } from "lucide-react";

import { cn, Skeleton } from "@wildfires-org/turboplan-utils";

import type { GroupedSearchResults } from "../types";
import { SearchResultItem } from "./search-result-item";

// ============================================================================
// TYPES
// ============================================================================

interface SearchResultsProps {
  /** Grouped search results to display */
  groupedResults: GroupedSearchResults[];
  /** Whether results are currently loading */
  isLoading: boolean;
  /** The search query (used for empty state messaging) */
  query: string;
  /** Error from search request */
  error?: Error;
  /** Callback when a result is selected (for closing the dropdown) */
  onResultSelect?: () => void;
  /** Layout variant: "default" (2 columns when >1 result) or "compact" (single column) */
  variant?: "default" | "compact";
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Loading skeleton for search results
 */
const SearchResultsSkeleton = () => (
  <div className="p-4 space-y-4">
    {/* Simulate 2 result groups */}
    {[1, 2].map((group) => (
      <div key={group} className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full rounded-lg" />
        {group === 1 && <Skeleton className="h-16 w-full rounded-lg" />}
      </div>
    ))}
  </div>
);

/**
 * Empty state when no results match the query
 */
const SearchResultsEmpty = ({ query }: { query: string }) => (
  <div className="px-4 py-8 text-center">
    <p className="text-sm text-muted-foreground">
      No results found for "{query}"
    </p>
    <p className="text-xs text-muted-foreground mt-1">
      Try a different search term
    </p>
  </div>
);

/**
 * Error state when search request fails
 */
const SearchResultsError = () => (
  <div className="px-4 py-8 text-center">
    <AlertCircle className="size-8 text-destructive mx-auto mb-2" />
    <p className="text-sm text-destructive font-medium">Something went wrong</p>
    <p className="text-xs text-muted-foreground mt-1">
      Unable to load search results. Please try again.
    </p>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Displays grouped search results with headers for each entity type.
 * Handles loading, empty, and error states.
 */
export const SearchResults = ({
  groupedResults,
  isLoading,
  query,
  error,
  onResultSelect,
  variant = "default",
}: SearchResultsProps) => {
  const useTwoColumnGrid = variant === "default";
  // Show error state when request fails
  if (error) {
    return <SearchResultsError />;
  }

  // Show skeleton during initial load
  if (isLoading && groupedResults.length === 0) {
    return <SearchResultsSkeleton />;
  }

  // Show empty state when no results
  if (!isLoading && groupedResults.length === 0 && query.length >= 2) {
    return <SearchResultsEmpty query={query} />;
  }

  // Render grouped results
  return (
    <div className="p-3 space-y-3">
      {groupedResults.map((group) => (
        <div key={group.type}>
          {/* Group header with count */}
          <div className="mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {group.label} ({group.results.length})
            </span>
          </div>

          {/* Group results */}
          <div
            className={cn(
              useTwoColumnGrid && group.results.length > 1
                ? "grid grid-cols-2 gap-2"
                : "space-y-2",
            )}
          >
            {group.results.map((result) => (
              <SearchResultItem
                key={result.id}
                result={result}
                onSelect={onResultSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
