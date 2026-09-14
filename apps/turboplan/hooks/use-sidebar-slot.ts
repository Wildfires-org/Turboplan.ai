import { type ReactNode, useEffect } from "react";

import { useSidebarContent } from "@/components/providers/sidebar-content-provider";

export function useSidebarSlot(content: ReactNode) {
  const { setContent } = useSidebarContent();

  useEffect(() => {
    setContent(content);
    return () => {
      setContent(null);
    };
  }, [content, setContent]);
}
