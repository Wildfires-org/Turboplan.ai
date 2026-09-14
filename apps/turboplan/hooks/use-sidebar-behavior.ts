import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { usePathname } from "next/navigation";

import { useSidebar } from "@/components/ui/sidebar";
import { useSidebarPin } from "@/hooks/use-sidebar-pin";

interface UseSidebarBehaviorOptions {
  defaultPinned?: boolean;
}

export function useSidebarBehavior({
  defaultPinned = false,
}: UseSidebarBehaviorOptions = {}) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const leaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const enterTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMouseOver = useRef(false);
  const { isPinned, setPin } = useSidebarPin(defaultPinned);
  const { setOpen } = useSidebar();
  const pathname = usePathname();

  // Collapse sidebar on route change when not pinned
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      if (!isPinned) {
        setOpen(false);
      }
    }
  }, [pathname, isPinned, setOpen]);

  // Set data-pinned attribute on the sidebar outer wrapper for CSS targeting
  useLayoutEffect(() => {
    if (sidebarRef.current) {
      sidebarRef.current.dataset.pinned = isPinned ? "true" : "false";
    }
  }, [isPinned]);

  // Sync open state when isPinned changes (but NOT when setOpen changes,
  // because Shadcn's setOpen gets a new reference on every open change,
  // which would reset the hover-open state back to false)
  const prevIsPinnedRef = useRef(isPinned);
  useLayoutEffect(() => {
    if (prevIsPinnedRef.current !== isPinned) {
      prevIsPinnedRef.current = isPinned;
      setOpen(isPinned);
    }
  }, [isPinned, setOpen]);

  const handleMouseEnter = useCallback(() => {
    isMouseOver.current = true;
    if (!isPinned) {
      if (leaveTimeout.current) {
        clearTimeout(leaveTimeout.current);
        leaveTimeout.current = null;
      }
      enterTimeout.current = setTimeout(() => {
        if (isMouseOver.current) {
          setOpen(true);
        }
      }, 300);
    }
  }, [isPinned, setOpen]);

  const handleMouseLeave = useCallback(() => {
    isMouseOver.current = false;
    if (enterTimeout.current) {
      clearTimeout(enterTimeout.current);
      enterTimeout.current = null;
    }
    if (!isPinned) {
      const tryCollapse = () => {
        // If a dropdown/popover is still open, retry later
        if (document.querySelector("[data-radix-popper-content-wrapper]")) {
          leaveTimeout.current = setTimeout(tryCollapse, 200);
          return;
        }
        // Mouse re-entered sidebar while we were waiting — don't collapse
        if (isMouseOver.current) {
          return;
        }
        setOpen(false);
      };
      leaveTimeout.current = setTimeout(tryCollapse, 200);
    }
  }, [isPinned, setOpen]);

  useEffect(() => {
    return () => {
      if (leaveTimeout.current) {
        clearTimeout(leaveTimeout.current);
      }
      if (enterTimeout.current) {
        clearTimeout(enterTimeout.current);
      }
    };
  }, []);

  const handleTogglePin = useCallback(() => {
    const newPinned = !isPinned;
    setPin(newPinned);
    setOpen(newPinned);
  }, [isPinned, setPin, setOpen]);

  return {
    sidebarRef,
    isPinned,
    handleMouseEnter,
    handleMouseLeave,
    handleTogglePin,
  };
}
