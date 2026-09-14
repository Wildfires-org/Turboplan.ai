"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import { useBoolean } from "usehooks-ts";

import { useResizablePanel } from "@/hooks/use-resizable-panel";

interface ResearchPanelContextType {
  isOpen: boolean;
  width: number;
  isDragging: boolean;
  toggle: () => void;
  setOpen: (value: boolean) => void;
  handleResizeStart: (e: React.MouseEvent) => void;
}

const ResearchPanelContext = createContext<ResearchPanelContextType>({
  isOpen: false,
  width: 595,
  isDragging: false,
  toggle: () => {},
  setOpen: () => {},
  handleResizeStart: () => {},
});

export function ResearchPanelProvider({ children }: { children: ReactNode }) {
  const { value: isOpen, toggle, setValue: setOpen } = useBoolean(false);

  const { width, isDragging, handleResizeStart } = useResizablePanel({
    storageKey: "research-panel-width",
    defaultWidth: 595,
    minWidth: 488,
    maxWidth: 780,
  });

  const value = useMemo(
    () => ({
      isOpen,
      width,
      isDragging,
      toggle,
      setOpen,
      handleResizeStart,
    }),
    [isOpen, width, isDragging, toggle, setOpen, handleResizeStart],
  );

  return (
    <ResearchPanelContext.Provider value={value}>
      {children}
    </ResearchPanelContext.Provider>
  );
}

export function useResearchPanel() {
  return useContext(ResearchPanelContext);
}
