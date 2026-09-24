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
import { AppUrls } from "@/lib/nav/urls";
import { SidebarChatList } from "./sidebar-chat-list";
import { SidebarInitialsBadge } from "./sidebar-initials-badge";

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
  projectName: string;
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
                  <SidebarInitialsBadge name={projectName} className="size-6" />
                  <span className="truncate font-normal group-data-[collapsible=icon]:hidden">
                    {projectName}
                  </span>
                </Link>
              </SidebarMenuButton>

              {/* Vertical connecting line (always visible, painted on top) */}
              <div className="absolute left-[20px] top-[40px] bottom-0 z-10 w-px bg-neutral-100 pointer-events-none" />

              {/* Nav sub-items */}
              <SidebarMenuSub className="ml-2 mr-0 translate-x-0 border-l-0 p-0 gap-0">
                {visibleNavItems.map((item) => {
                  const active = isActive(item);
                  const itemHref = item.href(orgSlug, officeSlug, projectSlug);

                  // Render Chat with expand/collapse and sub-list
                  if (item.label === "Chat" && projectId) {
                    return (
                      <SidebarChatList
                        key={item.label}
                        projectId={projectId}
                        isResearchPhaseCompleted={isResearchPhaseCompleted}
                      />
                    );
                  }

                  // Render other nav items normally
                  return (
                    <SidebarMenuSubItem key={item.label}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={active}
                        className={cn(
                          "h-11 rounded-lg pl-8 text-gray-550 hover:bg-brandAlt-100 hover:text-brandAlt-500 [&>svg]:text-current data-[active=true]:!bg-brandAlt-400 data-[active=true]:!text-white data-[active=true]:hover:!bg-brandAlt-400",
                          active &&
                            "!bg-brandAlt-400 !text-white shadow-sm hover:!bg-brandAlt-400 hover:!text-white",
                        )}
                      >
                        <Link href={itemHref}>
                          <item.icon className="size-5" />
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
                      "text-gray-550 hover:bg-brandAlt-100 hover:text-brandAlt-500 [&>svg]:text-current",
                      active &&
                        "!bg-brandAlt-400 !text-white hover:!bg-brandAlt-400 hover:!text-white data-[active=true]:!bg-brandAlt-400 data-[active=true]:!text-white",
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
