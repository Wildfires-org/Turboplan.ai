"use client";

import { ExternalLink, FileText, FolderOpen, PinIcon } from "lucide-react";

import { cn } from "@wildfires-org/turboplan-utils";

import type { SearchableEntityType, SearchResult } from "../types";

// ============================================================================
// TYPES
// ============================================================================

interface SearchResultItemProps {
  result: SearchResult;
  onSelect?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Returns the appropriate icon component for an entity type.
 * - Users: Organizations & Offices (people-based entities)
 * - FolderKanban: Projects (work items)
 */
const getEntityIcon = (type: SearchableEntityType) => {
  switch (type) {
    case "organization":
    case "office":
      return PinIcon;
    case "project":
      return FolderOpen;
    case "template":
      return FileText;
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Displays a single search result with icon, name, and breadcrumb trail.
 * The entire row is clickable and navigates to the entity's URL.
 */
export const SearchResultItem = ({
  result,
  onSelect,
}: SearchResultItemProps) => {
  const Icon = getEntityIcon(result.type);
  const isProject = result.type === "project" || result.type === "template";

  const handleClick = () => {
    onSelect?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.();
    }
  };

  // Format breadcrumbs as "Parent / Child" string
  const breadcrumbText =
    result.breadcrumbs.length > 0
      ? result.breadcrumbs.map((crumb) => crumb.name).join(" / ")
      : null;

  return (
    <a
      href={result.url}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-background",
        "cursor-pointer transition-colors",
        "hover:bg-accent/50 focus:bg-accent/50",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {/* Entity Icon */}
      <div className="flex-shrink-0">
        <Icon className="size-4 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Breadcrumb Trail (shown above name for projects) */}
        {isProject && breadcrumbText && (
          <div className="text-xs text-muted-foreground mb-1 truncate">
            {breadcrumbText}
          </div>
        )}

        {/* Entity Name */}
        <div className="text-sm text-foreground truncate">{result.name}</div>

        {/* Description (for projects) */}
        {isProject && result.description && (
          <div className="text-sm text-muted-foreground mt-1 truncate">
            {result.description}
          </div>
        )}

        {/* Breadcrumb Trail (shown below name for non-projects) */}
        {!isProject && breadcrumbText && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {breadcrumbText}
          </div>
        )}
      </div>

      {/* External Link Icon */}
      <div className="flex-shrink-0">
        <ExternalLink className="size-3 text-muted-foreground" />
      </div>
    </a>
  );
};
