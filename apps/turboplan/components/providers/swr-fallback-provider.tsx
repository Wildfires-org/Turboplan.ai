"use client";

import type { ReactNode } from "react";

import { SWRConfig } from "swr";

type SwrFallbackProviderProps = {
  /** SWR cache keys mapped to their pre-computed values. */
  fallback: Record<string, unknown>;
  children: ReactNode;
};

/**
 * Hands SSR-computed data to client SWR hooks under known cache keys.
 *
 * A server component fetches the data it already has cheap access to, builds
 * the same key the hook uses, and passes it here — the hook then renders with
 * real data on first paint instead of firing a request after hydration. Only
 * works for hooks that opt out of `revalidateIfStale`, otherwise SWR refetches
 * on mount anyway.
 *
 * Nested `SWRConfig` merges with any parent config, so wrapping part of a tree
 * does not clobber the app-level SWR configuration.
 */
export const SwrFallbackProvider = ({
  fallback,
  children,
}: SwrFallbackProviderProps) => {
  return <SWRConfig value={{ fallback }}>{children}</SWRConfig>;
};
