"use client";

import { useEffect, useState } from "react";

import { getMsUntilStale } from "../types";

/**
 * Whether a document pending since `pendingSince` (epoch ms) has waited past
 * the stale threshold. Re-renders once when the threshold passes, so the
 * spinner does not run forever.
 */
export const useIsExtractionStale = (
  isPending: boolean,
  pendingSince: number,
) => {
  const [isStale, setIsStale] = useState(
    () => isPending && getMsUntilStale(pendingSince) === 0,
  );

  useEffect(() => {
    if (!isPending) {
      setIsStale(false);
      return;
    }
    const delay = getMsUntilStale(pendingSince);
    if (delay === 0) {
      setIsStale(true);
      return;
    }
    setIsStale(false);
    if (!Number.isFinite(delay)) {
      return;
    }
    const timer = setTimeout(() => setIsStale(true), delay);
    return () => clearTimeout(timer);
  }, [isPending, pendingSince]);

  return isStale;
};
