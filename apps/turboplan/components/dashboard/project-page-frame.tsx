import type { ReactNode } from "react";

import type { User } from "next-auth";

import type {
  Office,
  Organization,
  Project,
} from "@wildfires-org/turboplan-workspace/types";

import {
  DashboardHeader,
  DashboardHeaderSkeleton,
} from "@/components/dashboard/dashboard-header";
import { EntityBannerShell } from "@/components/dashboard/entity-banner";
import { ProjectPageHeader } from "@/components/dashboard/project-page-header";
import { ProjectSubpageHeader } from "@/components/dashboard/project-subpage-header";
import { PAGE_CONTAINER_CLASS, SKELETON_BAR_CLASS } from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────

interface ProjectPageFrameProps {
  organization: Organization;
  office: Office;
  project: Project;
  coverImage: { imageUrl: string } | null;
  user?: User;
  /** Sub-view label (breadcrumb + subpage title). Omit on the overview. */
  section?: string;
  /** Rendered between the breadcrumb bar and the project header. */
  topSlot?: ReactNode;
  /** URL opened when the header's member avatars are clicked (overview). */
  membersHref?: string;
  /** Hide the subpage title row (views that render their own, e.g. Members). */
  hideSectionHeader?: boolean;
  children: ReactNode;
}

// ── Constants ─────────────────────────────────────────────────────────

const PAGE_ROOT_CLASS = "flex min-h-screen shrink-0 flex-col";

/** Content column below the project header (same container as the header). */
export const PROJECT_PAGE_BODY_CLASS = cn(
  PAGE_CONTAINER_CLASS,
  "flex-1 space-y-6 pb-12 pt-6",
);

const DEFAULT_COVER_URL = "/images/project-header-default-background.jpg";

// ── Helpers ───────────────────────────────────────────────────────────

export const getProjectBreadcrumbs = (
  organization: Organization,
  office: Office,
  project: Project,
  section?: string,
) => {
  const crumbs = [
    {
      label: organization.name,
      href: AppUrls.organization(organization.slug),
      isActive: false,
      entity: { type: "organization" as const, data: organization },
    },
    {
      label: office.name,
      href: AppUrls.office(organization.slug, office.slug),
      isActive: false,
      entity: {
        type: "office" as const,
        data: office,
        organizationSlug: organization.slug,
      },
    },
    {
      label: project.name,
      href: section
        ? AppUrls.project(organization.slug, office.slug, project.slug)
        : undefined,
      isActive: !section,
      entity: {
        type: "project" as const,
        data: project,
        organizationSlug: organization.slug,
        officeSlug: office.slug,
      },
    },
  ];

  return section ? [...crumbs, { label: section, isActive: true }] : crumbs;
};

// ── Components ────────────────────────────────────────────────────────

/** Breadcrumb bar + project header card + content column shared by the
 * project overview, every project sub-view and their loading state, so all
 * of them share one geometry (mirrors OfficePageFrame). Sub-views show a
 * read-only header (no actions/members) and a back + title row. */
export function ProjectPageFrame({
  organization,
  office,
  project,
  coverImage,
  user,
  section,
  topSlot,
  membersHref,
  hideSectionHeader = false,
  children,
}: ProjectPageFrameProps) {
  const isOverview = !section;

  return (
    <div className={PAGE_ROOT_CLASS}>
      <DashboardHeader
        breadcrumbs={getProjectBreadcrumbs(
          organization,
          office,
          project,
          section,
        )}
        userId={user?.id}
      />
      {topSlot}
      <ProjectPageHeader
        project={project}
        organization={organization}
        office={office}
        coverImage={coverImage}
        user={user}
        readOnly={!isOverview}
        membersHref={membersHref}
      />
      <div className={PROJECT_PAGE_BODY_CLASS}>
        {section && !hideSectionHeader && (
          <ProjectSubpageHeader
            title={section}
            backHref={AppUrls.project(
              organization.slug,
              office.slug,
              project.slug,
            )}
          />
        )}
        {children}
      </div>
    </div>
  );
}

/** Same frame before the project is known (office-level loading boundary):
 * only the name-bound parts are placeholders, each in a line box of the real
 * text's line-height so the swap doesn't move anything. */
export function ProjectPageFrameSkeleton({
  isOverview,
  children,
}: {
  isOverview: boolean;
  children: ReactNode;
}) {
  return (
    <div className={PAGE_ROOT_CLASS}>
      <DashboardHeaderSkeleton crumbs={isOverview ? 3 : 4} />
      <EntityBannerShell
        coverImageUrl={DEFAULT_COVER_URL}
        logo={
          <span
            aria-hidden
            className="size-full animate-pulse bg-brandAlt-200 motion-reduce:animate-none"
          />
        }
      >
        <div aria-hidden className="flex flex-col gap-2">
          <h1 className="text-[26px] font-medium leading-[1.15] sm:text-[30px]">
            <span
              className={cn(
                SKELETON_BAR_CLASS,
                "inline-block h-[0.7em] w-72 max-w-full rounded-lg align-middle",
              )}
            />
          </h1>
        </div>
      </EntityBannerShell>
      <div className={PROJECT_PAGE_BODY_CLASS}>{children}</div>
    </div>
  );
}
