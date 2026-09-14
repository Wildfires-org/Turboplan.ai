"use client";

import { useEffect, useState } from "react";

import { SIDEBAR_PIN_COOKIE } from "@/hooks/use-sidebar-pin";

function readSidebarPinnedCookie() {
  if (typeof globalThis.document === "undefined") {
    return false;
  }

  return globalThis.document.cookie.includes(`${SIDEBAR_PIN_COOKIE}=true`);
}

export function useSidebarPinnedState() {
  const [isSidebarPinned, setIsSidebarPinned] = useState(() =>
    readSidebarPinnedCookie(),
  );

  useEffect(() => {
    if (typeof globalThis.document === "undefined") {
      return;
    }

    const sidebarElement =
      globalThis.document.querySelector<HTMLElement>("[data-pinned]");

    if (!sidebarElement) {
      setIsSidebarPinned(readSidebarPinnedCookie());
      return;
    }

    const syncPinnedState = () => {
      setIsSidebarPinned(sidebarElement.dataset.pinned === "true");
    };

    syncPinnedState();

    const observer = new MutationObserver(syncPinnedState);
    observer.observe(sidebarElement, {
      attributes: true,
      attributeFilter: ["data-pinned"],
    });

    return () => observer.disconnect();
  }, []);

  return isSidebarPinned;
}
