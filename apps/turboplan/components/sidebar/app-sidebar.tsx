"use client";

import { useState } from "react";

import { Plus } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";

import { Button } from "@wildfires-org/turboplan-utils";

import { AddProjectDialog } from "@/components/dashboard/add-project-dialog";
import { useSidebarContent } from "@/components/providers/sidebar-content-provider";
import { useUser } from "@/components/providers/user-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useIsCitizen } from "@/hooks/use-citizen-mode";
import { useSidebarBehavior } from "@/hooks/use-sidebar-behavior";
import { brand } from "@/lib/brand";
import { NavUser } from "./nav-user";
import { SidebarBottomNav } from "./sidebar-bottom-nav";
import { SidebarCitizenContent } from "./sidebar-citizen-content";
import { SidebarOrgContent } from "./sidebar-org-content";
import { SidebarOrgSwitcher } from "./sidebar-org-switcher";
import { SidebarPinButton } from "./sidebar-pin-button";

interface AppSidebarProps {
  defaultPinned?: boolean;
}

export function AppSidebar({ defaultPinned = false }: AppSidebarProps) {
  const { user, profile } = useUser();
  const { content } = useSidebarContent();
  const params = useParams<{ orgSlug?: string; officeSlug?: string }>();
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const {
    sidebarRef,
    isPinned,
    handleMouseEnter,
    handleMouseLeave,
    handleTogglePin,
  } = useSidebarBehavior({ defaultPinned });

  const isCitizen = useIsCitizen();
  const appName = brand.name;

  const { orgSlug, officeSlug } = params;

  return (
    <Sidebar
      ref={sidebarRef}
      collapsible="icon"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarHeader className="pt-4 pl-5 flex flex-row items-center justify-between bg-neutral-200">
        <div className="flex items-center gap-2 overflow-hidden">
          <Image
            src={brand.logo}
            alt={appName}
            width={32}
            height={32}
            className="size-8 shrink-0"
          />
          <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">
            {appName}
          </span>
        </div>
        <div className="group-data-[collapsible=icon]:hidden">
          <SidebarPinButton isPinned={isPinned} onToggle={handleTogglePin} />
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-neutral-200 !overflow-hidden">
        <div className="flex flex-col gap-3 mt-2 shrink-0">
          {/* Org & Office switcher */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarOrgSwitcher />
            </SidebarGroupContent>
          </SidebarGroup>

          {/* New project button */}
          {orgSlug && officeSlug && (
            <SidebarGroup>
              <SidebarGroupContent>
                <Button
                  className="w-full h-11 justify-center gap-2 overflow-hidden rounded-md bg-brandAlt-400 text-white hover:bg-brandAlt-500 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:p-0"
                  onClick={() => setAddProjectOpen(true)}
                >
                  <Plus className="size-5 shrink-0" />
                  <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">
                    {isCitizen ? "New Application" : "New project"}
                  </span>
                </Button>
                <AddProjectDialog
                  organizationSlug={orgSlug}
                  officeSlug={officeSlug}
                  open={addProjectOpen}
                  onOpenChange={setAddProjectOpen}
                  onSuccess={() => setAddProjectOpen(false)}
                />
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {content ??
            (isCitizen && orgSlug && officeSlug ? (
              <SidebarCitizenContent
                organizationSlug={orgSlug}
                officeSlug={officeSlug}
              />
            ) : (
              <SidebarOrgContent />
            ))}
        </div>
        <SidebarBottomNav />
      </SidebarContent>

      <SidebarFooter className="bg-neutral-200 border-t border-neutral-300 py-0">
        {user && <NavUser user={user} profile={profile} />}
      </SidebarFooter>
    </Sidebar>
  );
}
