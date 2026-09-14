"use client";

import { createContext, useContext } from "react";

type AdminContextValue = {
  isSuperAdmin: boolean;
};

const AdminContext = createContext<AdminContextValue>({
  isSuperAdmin: false,
});

interface AdminProviderProps {
  isSuperAdmin: boolean;
  children: React.ReactNode;
}

export function AdminProvider({ isSuperAdmin, children }: AdminProviderProps) {
  return (
    <AdminContext.Provider value={{ isSuperAdmin }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdminContext() {
  return useContext(AdminContext);
}
