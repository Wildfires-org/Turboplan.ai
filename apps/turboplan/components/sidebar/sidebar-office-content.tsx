"use client";

import Link from "next/link";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useMyProjects } from "@/hooks/use-my-projects";
import { SKELETON_BAR_CLASS } from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import { cn } from "@/lib/utils";
import { SidebarInitialsBadge } from "./sidebar-initials-badge";

export function SidebarOfficeContent() {
  const { projects, isLoading } = useMyProjects();

  if (isLoading) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>My Projects</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {Array.from({ length: 3 }).map((_, i) => (
              <SidebarMenuItem key={i}>
                <SidebarMenuButton aria-hidden className="h-11" tabIndex={-1}>
                  <span
                    data-sidebar-keep=""
                    className={cn(
                      SKELETON_BAR_CLASS,
                      "size-5 shrink-0 rounded",
                    )}
                  />
                  <span className="flex flex-1 items-center group-data-[collapsible=icon]:hidden">
                    <span className={cn(SKELETON_BAR_CLASS, "h-3 w-24")} />
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>My Projects</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {projects.map((project) => (
            <SidebarMenuItem key={project.id}>
              <SidebarMenuButton
                tooltip={project.name}
                asChild
                className="h-11"
              >
                <Link
                  href={AppUrls.project(
                    project.orgSlug,
                    project.officeSlug,
                    project.slug,
                  )}
                  title={`${project.orgName} / ${project.officeName}`}
                >
                  <SidebarInitialsBadge name={project.name} />
                  <span>{project.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
