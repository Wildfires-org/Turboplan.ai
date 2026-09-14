"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";

import { Loader2, Search, X } from "lucide-react";
import { useDebounceValue, useOnClickOutside } from "usehooks-ts";

import { cn, Input } from "@wildfires-org/turboplan-utils";

import { useOmniSearch } from "../hooks/use-omni-search";
import { MIN_QUERY_LENGTH } from "../types";
import {
  OmniSearchContext,
  type OmniSearchVariant,
  useOmniSearchContext,
} from "./omni-search-context";
import { SearchResults } from "./search-results";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Debounce delay in milliseconds */
const DEBOUNCE_DELAY = 300;

// ============================================================================
// OMNI SEARCH ROOT
// ============================================================================

export interface OmniSearchRootProps {
  children: React.ReactNode;
  /** Optional CSS class name for the container */
  className?: string;
  /** Layout variant: "default" (2 columns) or "compact" (single column) */
  variant?: OmniSearchVariant;
  /** Controlled value (optional - for URL state management) */
  value?: string;
  /** Callback when value changes (optional - for URL state management) */
  onValueChange?: (value: string) => void;
}

/**
 * Root component that provides context for all OmniSearch primitives.
 * Contains all shared state and logic.
 */
export const OmniSearchRoot = ({
  children,
  className,
  variant = "default",
  value,
  onValueChange,
}: OmniSearchRootProps) => {
  // Internal state for uncontrolled mode
  const [internalQuery, setInternalQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Support both controlled and uncontrolled modes
  const isControlled = value !== undefined;
  const query = isControlled ? value : internalQuery;
  const setQuery = (newValue: string) => {
    if (isControlled) {
      onValueChange?.(newValue);
    } else {
      setInternalQuery(newValue);
    }
  };

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced query for API calls
  const [debouncedQuery] = useDebounceValue(query, DEBOUNCE_DELAY);

  // Search hook
  const { groupedResults, isLoading, error } = useOmniSearch(debouncedQuery);

  // Close dropdown when clicking outside
  useOnClickOutside(containerRef as React.RefObject<HTMLDivElement>, () =>
    setIsOpen(false),
  );

  // Determine if dropdown should be visible
  const showDropdown = isOpen && query.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!showDropdown) return;

    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [showDropdown]);

  const handleResultSelect = () => {
    setIsOpen(false);
  };

  const contextValue = {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    debouncedQuery,
    inputRef,
    variant,
    showDropdown,
    groupedResults,
    isLoading,
    error,
    onResultSelect: handleResultSelect,
  };

  return (
    <OmniSearchContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn("relative", showDropdown && "z-50", className)}
      >
        {children}
      </div>
    </OmniSearchContext.Provider>
  );
};

OmniSearchRoot.displayName = "OmniSearchRoot";

// ============================================================================
// OMNI SEARCH INPUT
// ============================================================================

export interface OmniSearchInputProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof Input>,
    "value" | "onChange"
  > {
  /** Optional placeholder text */
  placeholder?: string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Search input field with icon and clear button.
 * Must be used within OmniSearchRoot.
 */
export const OmniSearchInput = React.forwardRef<
  HTMLInputElement,
  OmniSearchInputProps
>(({ placeholder = "Search...", className, ...props }, ref) => {
  const {
    query,
    setQuery,
    isOpen,
    setIsOpen,
    inputRef,
    variant,
    showDropdown,
    isLoading,
  } = useOmniSearchContext();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (query.length >= MIN_QUERY_LENGTH) {
      setIsOpen(true);
    }
  };

  const handleClear = () => {
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Merge refs
  const mergedRef = React.useMemo(() => {
    return (node: HTMLInputElement | null) => {
      // Update the internal ref
      (inputRef as React.MutableRefObject<HTMLInputElement | null>).current =
        node;
      // Update the forwarded ref
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };
  }, [ref, inputRef]);

  return (
    <div className={cn("relative", showDropdown && "z-10")}>
      {/* Search Icon */}
      <Search className="absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none size-5 left-4" />

      <Input
        ref={mergedRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "text-base tracking-tight placeholder:text-gray-500",
          !showDropdown && "border rounded-3xl border-input bg-white",
          showDropdown &&
            "rounded-t-3xl border-transparent bg-transparent ring-0 ring-offset-0 outline-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none",
          variant === "default" && "px-12 h-12",
          variant === "compact" && "p-3 pl-11 h-11",
          className,
        )}
        aria-label="Search organizations, offices, and projects"
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
        autoComplete="off"
        {...props}
      />

      {/* Clear / Loading Indicator */}
      <div className="absolute top-1/2 -translate-y-1/2 right-4">
        {isLoading && query.length >= MIN_QUERY_LENGTH ? (
          <Loader2 className="size-4 text-muted-foreground animate-spin" />
        ) : query.length > 0 ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 rounded-sm hover:bg-accent transition-colors flex items-center justify-center"
            aria-label="Clear search"
          >
            <X className="size-4 text-muted-foreground" />
          </button>
        ) : null}
      </div>
    </div>
  );
});

OmniSearchInput.displayName = "OmniSearchInput";

// ============================================================================
// OMNI SEARCH OVERLAY
// ============================================================================

export interface OmniSearchOverlayProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Blurred background overlay that appears when search is open.
 * Can be placed anywhere within OmniSearchRoot.
 * Must be used within OmniSearchRoot.
 */
export const OmniSearchOverlay = React.forwardRef<
  HTMLDivElement,
  OmniSearchOverlayProps
>(({ className, ...props }, ref) => {
  const { showDropdown, setIsOpen } = useOmniSearchContext();

  if (!showDropdown) return null;

  return (
    <div
      ref={ref}
      onClick={() => setIsOpen(false)}
      className={cn(
        "fixed inset-0 bg-gray-500/5 -z-10 backdrop-blur-sm",
        "animate-in fade-in-0 duration-300",
        className,
      )}
      {...props}
    />
  );
});

OmniSearchOverlay.displayName = "OmniSearchOverlay";

// ============================================================================
// OMNI SEARCH CONTENT
// ============================================================================

export interface OmniSearchContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Dropdown container with search results.
 * Must be used within OmniSearchRoot.
 */
export const OmniSearchContent = React.forwardRef<
  HTMLDivElement,
  OmniSearchContentProps
>(({ className, ...props }, ref) => {
  const {
    showDropdown,
    variant,
    groupedResults,
    isLoading,
    debouncedQuery,
    error,
    onResultSelect,
  } = useOmniSearchContext();

  if (!showDropdown) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-0 left-0 right-0 z-0 rounded-2xl border border-gray-200 ring-4 border-green-60 ring-green-10 bg-white",
        className,
      )}
      {...props}
    >
      {/* Spacer matching input height */}
      <div
        className={cn(
          "border-b border-gray-200 mx-3",
          variant === "default" && "h-12",
          variant === "compact" && "h-11",
        )}
      />
      {/* Results */}
      <div
        className="max-h-[28rem] overflow-y-auto rounded-b-2xl"
        role="listbox"
      >
        <SearchResults
          groupedResults={groupedResults}
          isLoading={isLoading}
          query={debouncedQuery}
          error={error}
          onResultSelect={onResultSelect}
          variant={variant}
        />
      </div>
    </div>
  );
});

OmniSearchContent.displayName = "OmniSearchContent";
