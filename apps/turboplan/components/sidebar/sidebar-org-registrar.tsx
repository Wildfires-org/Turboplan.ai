"use client";

import { useMemo } from "react";

import { useSidebarSlot } from "@/hooks/use-sidebar-slot";
import { SidebarOrgContent } from "./sidebar-org-content";

export function SidebarOrgRegistrar() {
  const content = useMemo(() => <SidebarOrgContent />, []);
  useSidebarSlot(content);
  return null;
}
