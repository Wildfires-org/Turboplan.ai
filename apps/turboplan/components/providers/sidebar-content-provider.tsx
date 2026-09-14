"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

interface SidebarContentContextValue {
  content: ReactNode | null;
  setContent: (content: ReactNode | null) => void;
}

const SidebarContentContext = createContext<
  SidebarContentContextValue | undefined
>(undefined);

interface SidebarContentProviderProps {
  children: ReactNode;
}

export function SidebarContentProvider({
  children,
}: SidebarContentProviderProps) {
  const [content, setContentState] = useState<ReactNode | null>(null);

  const setContent = useCallback((node: ReactNode | null) => {
    setContentState(node);
  }, []);

  return (
    <SidebarContentContext.Provider value={{ content, setContent }}>
      {children}
    </SidebarContentContext.Provider>
  );
}

export function useSidebarContent() {
  const context = useContext(SidebarContentContext);
  if (context === undefined) {
    throw new Error(
      "useSidebarContent must be used within a SidebarContentProvider",
    );
  }
  return context;
}
