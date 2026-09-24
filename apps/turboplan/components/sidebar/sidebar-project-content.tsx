"use client";

import { useMemo } from "react";

import {
  ArrowLeft,
  BookOpen,
  BotMessageSquare,
  CheckSquare,
  FileSignature,
  FileText,
  Map,
  MessagesSquare,
  NotebookText,
  Route,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import {
  isDocumentsPackageEnabled,
  isMapPackageEnabled,
  isProjectContextPackageEnabled,
  isSigningPackageEnabled,
  isTasksPackageEnabled,
  isTimelineRecordsPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { cn } from "@wildfires-org/turboplan-utils";

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
import { SKELETON_BAR_CLASS } from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import {
  SidebarChatList,
  SidebarChatRowPlaceholder,
} from "./sidebar-chat-list";
import { SidebarInitialsBadge } from "./sidebar-initials-badge";
import {
  PROJECT_NAV_SUB_BUTTON_CLASS,
  PROJECT_NAV_SUB_CLASS,
  PROJECT_NAV_SUB_ITEM_CLASS,
} from "./sidebar-project-nav-classes";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: (orgSlug: string, officeSlug: string, projectSlug: string) => string;
  enabled?: () => boolean;
}

const projectNavItems: NavItem[] = [
  {
    label: "Overview",
    icon: NotebookText,
    href: (o, off, p) => AppUrls.project(o, off, p),
  },
  {
    label: "Chat",
    icon: BotMessageSquare,
    href: (o, off, p) => AppUrls.projectNewChat(o, off, p),
  },
  {
    label: "Map",
    icon: Map,
    href: (o, off, p) => AppUrls.projectMap(o, off, p),
    enabled: isMapPackageEnabled,
  },
  {
    label: "Tasks",
    icon: CheckSquare,
    href: (o, off, p) => AppUrls.projectTasks(o, off, p),
    enabled: isTasksPackageEnabled,
  },
  {
    label: "Timeline",
    icon: Route,
    href: (o, off, p) => AppUrls.projectTimeline(o, off, p),
    enabled: isTimelineRecordsPackageEnabled,
  },
  {
    label: "Comments",
    icon: MessagesSquare,
    href: (o, off, p) => AppUrls.projectComments(o, off, p),
  },
  {
    label: "Documents",
    icon: FileText,
    href: (o, off, p) => AppUrls.projectDocuments(o, off, p),
    enabled: isDocumentsPackageEnabled,
  },
  {
    label: "Signing",
    icon: FileSignature,
    href: (o, off, p) => AppUrls.projectSigning(o, off, p),
    enabled: isSigningPackageEnabled,
  },
  {
    label: "Context",
    icon: BookOpen,
    href: (o, off, p) => AppUrls.projectContext(o, off, p),
    enabled: isProjectContextPackageEnabled,
  },
  {
    label: "Members",
    icon: UsersRound,
    href: (o, off, p) => AppUrls.projectMembers(o, off, p),
  },
];

interface SidebarProjectContentProps {
  /** Omitted while the project is still loading: the badge and name render
   * as placeholders in the same boxes, everything else is static. */
  projectName?: string;
  projectId?: string;
  isResearchPhaseCompleted: boolean;
}

export function SidebarProjectContent({
  projectName,
  projectId,
  isResearchPhaseCompleted,
}: SidebarProjectContentProps) {
  const params = useParams<{
    orgSlug: string;
    officeSlug: string;
    projectSlug: string;
    chatId: string;
  }>();
  const pathname = usePathname();

  const { orgSlug, officeSlug, projectSlug } = params;

  const visibleNavItems = useMemo(
    () => projectNavItems.filter((item) => !item.enabled || item.enabled()),
    [],
  );

  const isOnChatsRoute =
    pathname.includes("/chats/") || pathname.includes("/chat");

  const isActive = (item: NavItem) => {
    const itemHref = item.href(orgSlug, officeSlug, projectSlug);
    if (item.label === "Overview") {
      const projectBase = AppUrls.project(orgSlug, officeSlug, projectSlug);
      return pathname === projectBase || pathname === `${projectBase}/overview`;
    }
    if (item.label === "Chat") {
      return isOnChatsRoute;
    }
    return pathname.startsWith(itemHref);
  };

  return (
    <>
      {/* Back to projects */}
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Back to Projects"
                asChild
                className="h-11"
              >
                <Link href={AppUrls.office(orgSlug, officeSlug)}>
                  <ArrowLeft className="size-4" />
                  <span className="text-xs">Back to Projects</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Active project */}
      <SidebarGroup>
        <SidebarGroupLabel className="whitespace-nowrap group-data-[collapsible=icon]:mt-0">
          Active project
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              {/* Project name with badge */}
              <SidebarMenuButton
                tooltip={projectName}
                asChild
                className="h-11 group-data-[collapsible=icon]:justify-center"
              >
                <Link href={AppUrls.project(orgSlug, officeSlug, projectSlug)}>
                  {projectName ? (
                    <SidebarInitialsBadge
                      name={projectName}
                      className="size-6"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className={cn(
                        SKELETON_BAR_CLASS,
                        "size-6 shrink-0 rounded",
                      )}
                    />
                  )}
                  {projectName ? (
                    <span className="truncate font-normal group-data-[collapsible=icon]:hidden">
                      {projectName}
                    </span>
                  ) : (
                    <span className="flex h-5 flex-1 items-center group-data-[collapsible=icon]:hidden">
                      <span
                        aria-hidden
                        className={cn(SKELETON_BAR_CLASS, "h-3 w-32")}
                      />
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>

              {/* Nav sub-items, hung off a guide line centred under the
                  project badge. Pills are inset past the line so it never
                  crosses them; the active row marks its line segment. */}
              <SidebarMenuSub className={PROJECT_NAV_SUB_CLASS}>
                {visibleNavItems.map((item) => {
                  const active = isActive(item);
                  const itemHref = item.href(orgSlug, officeSlug, projectSlug);

                  // Render Chat with expand/collapse and sub-list
                  if (item.label === "Chat") {
                    return projectId ? (
                      <SidebarChatList
                        key={item.label}
                        projectId={projectId}
                        isResearchPhaseCompleted={isResearchPhaseCompleted}
                      />
                    ) : (
                      <SidebarChatRowPlaceholder key={item.label} />
                    );
                  }

                  // Render other nav items normally
                  return (
                    <SidebarMenuSubItem
                      key={item.label}
                      data-active={active}
                      className={PROJECT_NAV_SUB_ITEM_CLASS}
                    >
                      <SidebarMenuSubButton
                        asChild
                        isActive={active}
                        className={PROJECT_NAV_SUB_BUTTON_CLASS}
                      >
                        <Link href={itemHref}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </SidebarMenuItem>

            {/* Collapsed-only nav icons */}
            {visibleNavItems.map((item) => {
              const active = isActive(item);
              const itemHref = item.href(orgSlug, officeSlug, projectSlug);

              return (
                <SidebarMenuItem
                  key={`collapsed-${item.label}`}
                  className="hidden group-data-[collapsible=icon]:block"
                >
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={active}
                    asChild
                    className={cn(
                      "text-gray-550 hover:bg-brandAlt-100 hover:text-brand-900 [&>svg]:text-current",
                      active &&
                        "!bg-brand-800 !text-white hover:!bg-brand-800 hover:!text-white data-[active=true]:!bg-brand-800 data-[active=true]:!text-white",
                    )}
                  >
                    <Link href={itemHref}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
