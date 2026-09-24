"use client";

import type { ReactNode } from "react";

import { useParams, usePathname } from "next/navigation";
import type { User } from "next-auth";

import type { Project } from "@wildfires-org/turboplan-workspace/types";

import { ProjectChatRouteLoading } from "@/components/chat/project-chat-route-loading";
import { CommentsPage } from "@/components/dashboard/comments/comments-page";
import {
  DashboardHeader,
  DashboardHeaderSkeleton,
} from "@/components/dashboard/dashboard-header";
import { ProjectContextPageSection } from "@/components/dashboard/module-sections/project-context-page-section";
import { ProjectModulesSkeleton } from "@/components/dashboard/module-skeleton";
import { ProjectMembersSection } from "@/components/dashboard/project-members-section";
import {
  getProjectBreadcrumbs,
  ProjectPageFrame,
  ProjectPageFrameSkeleton,
} from "@/components/dashboard/project-page-frame";
import { ProjectSubpageHeader } from "@/components/dashboard/project-subpage-header";
import { ProjectTasks } from "@/components/dashboard/project-tasks";
import { TimelinePage } from "@/components/dashboard/timeline/timeline-page";
import { ProjectDocumentsPageSection } from "@/components/documents/project-documents-page-section";
import { useOptionalDashboard } from "@/components/providers/dashboard-provider";
import { useUser } from "@/components/providers/user-provider";
import {
  FLUSH_PANEL_CLASS,
  PANEL_CLASS,
  SKELETON_BAR_CLASS,
} from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────

type ProjectRoute =
  | "overview"
  | "tasks"
  | "timeline"
  | "comments"
  | "documents"
  | "context"
  | "members"
  | "signing"
  | "map"
  | "chat"
  | "other";

interface SubviewBodyProps {
  route: ProjectRoute;
  project: Project | null;
  organizationId: string | null;
  projectUrl: string;
  user: User | null;
}

// ── Constants ─────────────────────────────────────────────────────────

const SECTION_LABELS: Partial<Record<ProjectRoute, string>> = {
  tasks: "Tasks",
  timeline: "Timeline",
  comments: "Comments",
  documents: "Documents",
  context: "Context",
  members: "Members",
  signing: "Signing",
};

const SUBVIEW_ROUTES = new Set<ProjectRoute>([
  "tasks",
  "timeline",
  "comments",
  "documents",
  "context",
  "members",
  "signing",
]);

// ── Helpers ───────────────────────────────────────────────────────────

const getProjectRoute = (
  pathname: string,
  projectUrl: string,
): ProjectRoute => {
  if (pathname === projectUrl || pathname === `${projectUrl}/overview`) {
    return "overview";
  }
  const segment = pathname.slice(projectUrl.length + 1).split("/")[0];
  if (segment === "chat" || segment === "chats") {
    return "chat";
  }
  if (segment === "map" || SUBVIEW_ROUTES.has(segment as ProjectRoute)) {
    return segment as ProjectRoute;
  }
  return "other";
};

// ── Component ─────────────────────────────────────────────────────────

/**
 * Loading state for the project overview and every project sub-view. Renders
 * the real page frame (breadcrumbs, project header card, back + title row)
 * and, where the project is known, the real sub-view component, whose own
 * placeholders mirror its rows — so nothing moves when the page lands.
 * Project data comes from the project layout's DashboardProvider; above that
 * layout (office-level boundary) the name-bound parts are placeholders.
 */
export function ProjectRouteLoading() {
  const params = useParams<{
    orgSlug: string;
    officeSlug: string;
    projectSlug: string;
  }>();
  const pathname = usePathname();
  const dashboard = useOptionalDashboard();
  const { user } = useUser();

  const projectUrl = AppUrls.project(
    params.orgSlug,
    params.officeSlug,
    params.projectSlug,
  );
  const route = getProjectRoute(pathname, projectUrl);

  const organization = dashboard?.organization ?? null;
  const office = dashboard?.office ?? null;
  const project = dashboard?.project ?? null;

  if (route === "chat") {
    return <ProjectChatRouteLoading />;
  }

  if (route === "map") {
    return (
      <div className="flex h-screen flex-col">
        {organization && office && project ? (
          <DashboardHeader
            breadcrumbs={getProjectBreadcrumbs(
              organization,
              office,
              project,
              "Map",
            )}
            userId={user?.id}
          />
        ) : (
          <DashboardHeaderSkeleton crumbs={4} />
        )}
        <div
          aria-hidden
          className="flex-1 animate-pulse bg-brandAlt-200/60 motion-reduce:animate-none"
        />
      </div>
    );
  }

  const section = SECTION_LABELS[route];
  const body = (
    <SubviewBody
      route={route}
      project={project}
      organizationId={organization?.id ?? null}
      projectUrl={projectUrl}
      user={user}
    />
  );

  if (organization && office && project) {
    return (
      <ProjectPageFrame
        organization={organization}
        office={office}
        project={project}
        coverImage={
          dashboard?.projectCoverImageUrl
            ? { imageUrl: dashboard.projectCoverImageUrl }
            : null
        }
        user={user ?? undefined}
        section={section}
        hideSectionHeader={route === "members"}
      >
        {body}
      </ProjectPageFrame>
    );
  }

  return (
    <ProjectPageFrameSkeleton isOverview={route === "overview"}>
      {section && (
        <ProjectSubpageHeader title={section} backHref={projectUrl} />
      )}
      {body}
    </ProjectPageFrameSkeleton>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

const SubviewBody = ({
  route,
  project,
  organizationId,
  projectUrl,
  user,
}: SubviewBodyProps) => {
  const userId = user?.id;

  if (route === "overview") {
    return <ProjectModulesSkeleton />;
  }

  // Real sub-view components once the project (and viewer) are known: they
  // show their own row placeholders while SWR loads, identical to the page.
  if (project && user && userId) {
    switch (route) {
      case "tasks":
        return (
          <div className={FLUSH_PANEL_CLASS}>
            <ProjectTasks
              projectId={project.id}
              projectName={project.name}
              user={user}
            />
          </div>
        );
      case "timeline":
        return <TimelinePage projectId={project.id} />;
      case "comments":
        return <CommentsPage projectId={project.id} userId={userId} />;
      case "documents":
        return (
          <ProjectDocumentsPageSection projectId={project.id} userId={userId} />
        );
      case "context":
        return (
          <ProjectContextPageSection projectId={project.id} userId={userId} />
        );
      case "members":
        if (organizationId) {
          return (
            <ProjectMembersSection
              user={user}
              project={project}
              organizationId={organizationId}
              backHref={projectUrl}
            />
          );
        }
        break;
      default:
        break;
    }
  }

  return <PanelSkeleton />;
};

/** Generic sub-view body: a glass panel with a few row placeholders. */
const PanelSkeleton = (): ReactNode => (
  <div aria-hidden className={cn(PANEL_CLASS, "space-y-3")}>
    {[0, 1, 2, 3].map((row) => (
      <div key={row} className={cn(SKELETON_BAR_CLASS, "h-14 rounded-xl")} />
    ))}
  </div>
);
