"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export interface IGlobalContext {
  enableAutoScroll: boolean;
  setEnableAutoScroll: React.Dispatch<React.SetStateAction<boolean>>;
}

export const GlobalContext = createContext<IGlobalContext | undefined>(
  undefined,
);

export const useGlobalContext = () => {
  const context = useContext(GlobalContext);
  if (!context)
    throw new Error("useGlobalContext must be used within the GlobalProvider");

  return context;
};

function GlobalProvider({ children }: { children: React.ReactNode }) {
  const [enableAutoScroll, setEnableAutoScroll] = useState(true);

  const value = useMemo(
    () => ({
      enableAutoScroll,
      setEnableAutoScroll,
    }),
    [enableAutoScroll, setEnableAutoScroll],
  );

  return (
    <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>
  );
}

export default GlobalProvider;
