"use client";

import type { RefObject } from "react";
import { createContext, useContext } from "react";

import type { GroupedSearchResults } from "../types";

// ============================================================================
// TYPES
// ============================================================================

export type OmniSearchVariant = "default" | "compact";

export type OmniSearchContextValue = {
  /** Whether the dropdown is open */
  isOpen: boolean;
  /** Set the open state */
  setIsOpen: (open: boolean) => void;
  /** Current search query */
  query: string;
  /** Set the search query */
  setQuery: (query: string) => void;
  /** Debounced query for API calls */
  debouncedQuery: string;
  /** Reference to the input element */
  inputRef: RefObject<HTMLInputElement | null>;
  /** Layout variant */
  variant: OmniSearchVariant;
  /** Whether the dropdown should be visible */
  showDropdown: boolean;
  /** Grouped search results */
  groupedResults: GroupedSearchResults[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | undefined;
  /** Callback when a result is selected */
  onResultSelect: () => void;
};

// ============================================================================
// CONTEXT
// ============================================================================

export const OmniSearchContext = createContext<OmniSearchContextValue | null>(
  null,
);

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to access OmniSearch context.
 * Must be used within an OmniSearchRoot component.
 *
 * @throws Error if used outside of OmniSearchRoot
 */
export function useOmniSearchContext(): OmniSearchContextValue {
  const context = useContext(OmniSearchContext);
  if (!context) {
    throw new Error("OmniSearch components must be used within OmniSearchRoot");
  }
  return context;
}
