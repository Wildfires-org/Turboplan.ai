import type { ReactNode } from "react";

import type {
  Office,
  Organization,
} from "@wildfires-org/turboplan-workspace/types";

import {
  DashboardHeader,
  DashboardHeaderSkeleton,
} from "@/components/dashboard/dashboard-header";
import { EntityBanner } from "@/components/dashboard/entity-banner";
import { OfficeBannerActions } from "@/components/dashboard/office-banner-actions";
import { StickyEntityBanner } from "@/components/dashboard/sticky-entity-banner";
import { SidebarOfficeRegistrar } from "@/components/sidebar/sidebar-office-registrar";
import { PAGE_CONTAINER_CLASS, SKELETON_BAR_CLASS } from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────

export type OfficeTab =
  | "projects"
  | "members"
  | "my-submissions"
  | "citizen-submissions";

interface OfficePageFrameProps {
  organization: Organization;
  office: Office;
  userId?: string;
  tab: OfficeTab;
  children: ReactNode;
}

// ── Constants ─────────────────────────────────────────────────────────

const TAB_BREADCRUMB_LABELS: Record<Exclude<OfficeTab, "projects">, string> = {
  members: "Members",
  "my-submissions": "My Submissions",
  "citizen-submissions": "Citizen Submissions",
};

const PAGE_ROOT_CLASS = "flex min-h-screen shrink-0 flex-col";
const PAGE_BODY_CLASS = cn(PAGE_CONTAINER_CLASS, "flex-1 pb-12");

// ── Helpers ───────────────────────────────────────────────────────────

const getOfficeBreadcrumbs = (
  organization: Organization,
  office: Office,
  tab: OfficeTab,
) => {
  const organizationCrumb = {
    label: organization.name,
    href: AppUrls.organization(organization.slug),
    isActive: false,
    entity: { type: "organization" as const, data: organization },
  };

  if (tab === "projects") {
    return [organizationCrumb, { label: office.name, isActive: true }];
  }

  return [
    organizationCrumb,
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
    { label: TAB_BREADCRUMB_LABELS[tab], isActive: true },
  ];
};

// ── Components ────────────────────────────────────────────────────────

/** Header bar + office header card + content column shared by every office
 * tab page and by the office loading states, so they share one geometry. */
export function OfficePageFrame({
  organization,
  office,
  userId,
  tab,
  children,
}: OfficePageFrameProps) {
  return (
    <>
      <SidebarOfficeRegistrar />
      <div className={PAGE_ROOT_CLASS}>
        <DashboardHeader
          breadcrumbs={getOfficeBreadcrumbs(organization, office, tab)}
          userId={userId}
        />
        <StickyEntityBanner
          logoUrl={office.logoUrl ?? organization.logoUrl}
          title={office.name}
          description={office.description}
          actions={
            <OfficeBannerActions
              organizationSlug={organization.slug}
              office={office}
            />
          }
        />
        <div className={PAGE_BODY_CLASS}>{children}</div>
      </div>
    </>
  );
}

/** Same frame before the entity is known (org-level loading boundary): only
 * the name-bound parts are placeholders. Each placeholder sits in a line box
 * of the real text's line-height, so the swap doesn't move anything. */
export function EntityPageFrameSkeleton({
  crumbs = 2,
  children,
}: {
  crumbs?: number;
  children: ReactNode;
}) {
  return (
    <div className={PAGE_ROOT_CLASS}>
      <DashboardHeaderSkeleton crumbs={crumbs} />
      <EntityBanner
        title={
          <span
            aria-hidden
            className={cn(
              SKELETON_BAR_CLASS,
              "inline-block h-[0.7em] w-56 max-w-full rounded-lg align-middle",
            )}
          />
        }
        description={
          <span
            aria-hidden
            className={cn(
              SKELETON_BAR_CLASS,
              "inline-block h-3 w-48 max-w-full align-middle",
            )}
          />
        }
        actions={
          <>
            <span
              aria-hidden
              className="glass h-9 w-[153px] animate-pulse rounded-xl motion-reduce:animate-none"
            />
            <span
              aria-hidden
              className="h-9 w-[136px] animate-pulse rounded-xl bg-brand-800/25 motion-reduce:animate-none"
            />
          </>
        }
      />
      <div className={PAGE_BODY_CLASS}>{children}</div>
    </div>
  );
}
