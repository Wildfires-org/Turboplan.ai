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
      className="border-r border-white bg-white"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarHeader className="h-16 flex-row items-center gap-0 overflow-hidden bg-white px-2.5 py-0">
        <div className="flex size-11 shrink-0 items-center justify-center">
          <Image
            src={brand.logo}
            alt={appName}
            width={32}
            height={32}
            priority
            className="size-8 shrink-0 select-none"
            draggable={false}
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span className="truncate whitespace-nowrap text-lg font-semibold transition-opacity duration-150 group-data-[state=expanded]:delay-150 group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:opacity-0">
            {appName}
          </span>
        </div>
        <div className="ml-auto shrink-0 pr-1 group-data-[collapsible=icon]:hidden">
          <SidebarPinButton isPinned={isPinned} onToggle={handleTogglePin} />
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-white !overflow-hidden">
        <div className="mt-2 flex shrink-0 flex-col gap-3">
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
                  className="h-11 w-full justify-center gap-2 overflow-hidden rounded-lg bg-brandAlt-400 text-white shadow-sm hover:bg-brandAlt-500 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:p-0"
                  onClick={() => setAddProjectOpen(true)}
                >
                  <Plus className="size-5 shrink-0" />
                  <span className="whitespace-nowrap text-sm font-medium group-data-[collapsible=icon]:hidden">
                    New project
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

      <SidebarFooter className="border-t border-neutral-100 bg-white py-0">
        {user && <NavUser user={user} profile={profile} />}
      </SidebarFooter>
    </Sidebar>
  );
}
