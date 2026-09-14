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
import { AppUrls } from "@/lib/nav/urls";
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
                <SidebarMenuButton className="h-11">
                  <div className="size-5 animate-pulse rounded bg-neutral-300" />
                  <div className="h-4 w-24 animate-pulse rounded bg-neutral-300" />
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
