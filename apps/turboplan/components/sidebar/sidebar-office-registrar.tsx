"use client";

import { useMemo } from "react";

import { useParams } from "next/navigation";

import { useIsCitizen } from "@/hooks/use-citizen-mode";
import { useSidebarSlot } from "@/hooks/use-sidebar-slot";
import { SidebarCitizenContent } from "./sidebar-citizen-content";
import { SidebarOfficeContent } from "./sidebar-office-content";

export function SidebarOfficeRegistrar() {
  const isCitizen = useIsCitizen();
  const params = useParams<{ orgSlug: string; officeSlug: string }>();

  const content = useMemo(
    () =>
      isCitizen ? (
        <SidebarCitizenContent
          organizationSlug={params.orgSlug}
          officeSlug={params.officeSlug}
        />
      ) : (
        <SidebarOfficeContent />
      ),
    [isCitizen, params.orgSlug, params.officeSlug],
  );
  useSidebarSlot(content);
  return null;
}
