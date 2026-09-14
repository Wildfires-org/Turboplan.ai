"use client";

import { useCallback, useState } from "react";

export const SIDEBAR_PIN_COOKIE = "sidebar_pinned";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function useSidebarPin(defaultPinned = false) {
  const [isPinned, setIsPinned] = useState(defaultPinned);

  const setPin = useCallback((pinned: boolean) => {
    setIsPinned(pinned);
    document.cookie = `${SIDEBAR_PIN_COOKIE}=${pinned}; path=/; max-age=${COOKIE_MAX_AGE}`;
  }, []);

  const togglePin = useCallback(() => {
    setPin(!isPinned);
  }, [isPinned, setPin]);

  return { isPinned, setPin, togglePin };
}
