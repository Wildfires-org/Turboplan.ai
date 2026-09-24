"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useCitizenProjects } from "@/hooks/use-citizen-projects";
import { SKELETON_BAR_CLASS } from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import { cn } from "@/lib/utils";

interface SidebarCitizenContentProps {
  organizationSlug: string;
  officeSlug: string;
}

const LoadingSkeleton = ({ label }: { label: string }) => (
  <SidebarGroup>
    <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider text-gray-500">
      {label}
    </SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {Array.from({ length: 3 }).map((_, i) => (
          <SidebarMenuItem key={i}>
            <SidebarMenuButton aria-hidden className="h-11" tabIndex={-1}>
              <span
                className={cn(SKELETON_BAR_CLASS, "size-4 shrink-0 rounded")}
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

const ProjectItem = ({
  project,
  organizationSlug,
  officeSlug,
  isActive,
}: {
  project: { id: string; name: string; slug: string };
  organizationSlug: string;
  officeSlug: string;
  isActive: boolean;
}) => {
  const projectHref = AppUrls.project(
    organizationSlug,
    officeSlug,
    project.slug,
  );

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={project.name}
        asChild
        isActive={isActive}
        className="h-11"
      >
        <Link href={projectHref}>
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span>{project.name}</span>
        </Link>
      </SidebarMenuButton>
      {isActive && (
        <SidebarMenuSub className="group-data-[collapsible=icon]:!block group-data-[collapsible=icon]:invisible">
          <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive>
              <Link href={projectHref}>
                <FileText className="size-4 shrink-0" />
                <span>Overview</span>
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
};

export function SidebarCitizenContent({
  organizationSlug,
  officeSlug,
}: SidebarCitizenContentProps) {
  const { drafts, submitted, isLoading } = useCitizenProjects({
    organizationSlug,
    officeSlug,
  });
  const params = useParams<{ projectSlug?: string }>();
  const activeProjectSlug = params.projectSlug;

  if (isLoading) {
    return (
      <>
        <LoadingSkeleton label="My Drafts" />
        <LoadingSkeleton label="Submitted" />
      </>
    );
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider text-gray-500 whitespace-nowrap group-data-[collapsible=icon]:invisible">
          My Drafts
        </SidebarGroupLabel>
        <SidebarGroupContent>
          {drafts.length === 0 ? (
            <p className="px-2 py-1 text-sm text-muted-foreground whitespace-nowrap group-data-[collapsible=icon]:invisible">
              No active drafts yet
            </p>
          ) : (
            <SidebarMenu>
              {drafts.map((project) => (
                <ProjectItem
                  key={project.id}
                  project={project}
                  organizationSlug={organizationSlug}
                  officeSlug={officeSlug}
                  isActive={activeProjectSlug === project.slug}
                />
              ))}
            </SidebarMenu>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider text-gray-500 whitespace-nowrap group-data-[collapsible=icon]:invisible">
          Submitted
        </SidebarGroupLabel>
        <SidebarGroupContent>
          {submitted.length === 0 ? (
            <p className="px-2 py-1 text-sm text-muted-foreground whitespace-nowrap group-data-[collapsible=icon]:invisible">
              No submissions yet
            </p>
          ) : (
            <SidebarMenu>
              {submitted.map((project) => (
                <ProjectItem
                  key={project.id}
                  project={project}
                  // Submitted projects have moved, so link to their CURRENT
                  // location rather than the citizen's org/office.
                  organizationSlug={project.organizationSlug}
                  officeSlug={project.officeSlug}
                  isActive={activeProjectSlug === project.slug}
                />
              ))}
            </SidebarMenu>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
