"use client";

import {
  OmniSearchContent,
  OmniSearchInput,
  OmniSearchOverlay,
  OmniSearchRoot,
} from "./omni-search-primitives";

interface OmniSearchProps {
  placeholder?: string;
  className?: string;
  /** Layout variant: "default" (2 columns) or "compact" (single column) */
  variant?: "default" | "compact";
  /** Controlled value (optional - for URL state management) */
  value?: string;
  /** Callback when value changes (optional - for URL state management) */
  onValueChange?: (value: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * OmniSearch component providing a search input with dropdown results.
 *
 * Features:
 * - Debounced search input (300ms)
 * - Dropdown appears when input is focused AND query length >= 2
 * - Click outside closes the dropdown
 * - Loading state with spinner
 * - Empty state messaging
 * - Clear button to reset search
 *
 * @example
 * ```tsx
 * // Simple usage (pre-composed)
 * <OmniSearch placeholder="Search organizations, offices, projects..." />
 *
 * // Composable usage with primitives
 * <OmniSearch.Root>
 *   <OmniSearch.Input placeholder="Search..." />
 *   <OmniSearch.Overlay className="custom-blur" />
 *   <OmniSearch.Content />
 * </OmniSearch.Root>
 * ```
 */
export const OmniSearch = ({
  placeholder = "Search...",
  className,
  variant = "default",
  value,
  onValueChange,
}: OmniSearchProps) => {
  return (
    <OmniSearchRoot
      className={className}
      variant={variant}
      value={value}
      onValueChange={onValueChange}
    >
      <OmniSearchInput placeholder={placeholder} />
      <OmniSearchOverlay />
      <OmniSearchContent />
    </OmniSearchRoot>
  );
};

// ============================================================================
// COMPOUND COMPONENT EXPORTS
// ============================================================================

OmniSearch.Root = OmniSearchRoot;
OmniSearch.Input = OmniSearchInput;
OmniSearch.Overlay = OmniSearchOverlay;
OmniSearch.Content = OmniSearchContent;
