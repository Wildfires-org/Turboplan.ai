"use client";

import { useParams, usePathname } from "next/navigation";
import type { User } from "next-auth";

import { MembersTable } from "@wildfires-org/turboplan-workspace/client";
import type {
  Office,
  Organization,
} from "@wildfires-org/turboplan-workspace/types";

import ProjectLoading from "@/app/(dashboard)/organizations/[orgSlug]/offices/[officeSlug]/projects/[projectSlug]/loading";
import { CitizenSubmissionsSection } from "@/components/dashboard/citizen-submissions-section";
import { DashboardHeaderSkeleton } from "@/components/dashboard/dashboard-header";
import { InviteMembersProvider } from "@/components/dashboard/invite-members-context";
import { MySubmissionsSection } from "@/components/dashboard/my-submissions-section";
import { OfficeMembersSection } from "@/components/dashboard/office-members-section";
import {
  EntityPageFrameSkeleton,
  OfficePageFrame,
  type OfficeTab,
} from "@/components/dashboard/office-page-frame";
import { OfficeTabNav } from "@/components/dashboard/office-tab-nav";
import { ProjectsCardSection } from "@/components/dashboard/projects-card-section";
import { TemplatesGridSection } from "@/components/dashboard/templates-grid-section";
import { useOptionalDashboard } from "@/components/providers/dashboard-provider";
import { useUser } from "@/components/providers/user-provider";
import { PAGE_CONTAINER_CLASS, STICKY_TOOLBAR_CLASS } from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";

// ── Types ─────────────────────────────────────────────────────────────

type OfficeRoute = OfficeTab | "project" | "other";

interface OfficeTabBodyProps {
  tab: OfficeTab;
  user: User | null;
  orgSlug: string;
  officeSlug: string;
  office: Office | null;
}

// ── Constants ─────────────────────────────────────────────────────────

const noop = () => {};

// ── Helpers ───────────────────────────────────────────────────────────

const getOfficeRoute = (
  pathname: string,
  orgSlug: string,
  officeSlug: string,
): OfficeRoute => {
  const officeUrl = AppUrls.office(orgSlug, officeSlug);
  if (pathname === officeUrl) {
    return "projects";
  }
  const rest = pathname.slice(officeUrl.length + 1).split("/")[0];
  if (
    rest === "members" ||
    rest === "my-submissions" ||
    rest === "citizen-submissions"
  ) {
    return rest;
  }
  // Only the templates list shares the office frame (template detail and
  // document templates have their own layouts).
  if (pathname === AppUrls.officeProjectTemplates(orgSlug, officeSlug)) {
    return "templates";
  }
  if (rest === "projects") {
    return "project";
  }
  return "other";
};

// ── Component ─────────────────────────────────────────────────────────

/**
 * Loading state for every office tab. Renders the real page frame (header,
 * office header card, tabs, toolbars) and the real tab section — whose own
 * placeholders mirror its cards/rows — so nothing moves when the page lands.
 * Office data comes from the office layout's DashboardProvider; above that
 * layout (org-level boundary) only the office name/description/actions are
 * placeholders.
 */
export function OfficeRouteLoading() {
  const params = useParams<{ orgSlug: string; officeSlug: string }>();
  const pathname = usePathname();
  const dashboard = useOptionalDashboard();
  const { user } = useUser();

  const route = getOfficeRoute(pathname, params.orgSlug, params.officeSlug);

  if (route === "project") {
    return <ProjectLoading />;
  }

  if (route === "other") {
    return (
      <div className="flex min-h-screen shrink-0 flex-col">
        <DashboardHeaderSkeleton crumbs={3} />
        <div className={PAGE_CONTAINER_CLASS} />
      </div>
    );
  }

  const organization: Organization | null = dashboard?.organization ?? null;
  const office: Office | null = dashboard?.office ?? null;

  const body = (
    <OfficeTabBody
      tab={route}
      user={user}
      orgSlug={params.orgSlug}
      officeSlug={params.officeSlug}
      office={office}
    />
  );

  return (
    <InviteMembersProvider>
      {organization && office ? (
        <OfficePageFrame
          organization={organization}
          office={office}
          userId={user?.id}
          tab={route}
        >
          {body}
        </OfficePageFrame>
      ) : (
        <EntityPageFrameSkeleton crumbs={route === "projects" ? 2 : 3}>
          {body}
        </EntityPageFrameSkeleton>
      )}
    </InviteMembersProvider>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

const OfficeTabBody = ({
  tab,
  user,
  orgSlug,
  officeSlug,
  office,
}: OfficeTabBodyProps) => {
  switch (tab) {
    case "projects":
      return (
        <ProjectsCardSection
          user={user ?? undefined}
          organizationSlug={orgSlug}
          officeSlug={officeSlug}
        />
      );
    case "my-submissions":
      return (
        <MySubmissionsSection
          organizationSlug={orgSlug}
          officeSlug={officeSlug}
        />
      );
    case "citizen-submissions":
      return (
        <CitizenSubmissionsSection
          organizationSlug={orgSlug}
          officeSlug={officeSlug}
        />
      );
    case "templates":
      return (
        <TemplatesGridSection
          organizationSlug={orgSlug}
          officeSlug={officeSlug}
        />
      );
    case "members":
      if (user && office) {
        return (
          <OfficeMembersSection
            user={user}
            office={office}
            orgSlug={orgSlug}
            officeSlug={officeSlug}
          />
        );
      }
      return <MembersSkeleton orgSlug={orgSlug} officeSlug={officeSlug} />;
  }
};

/** Members tab before the office id is known: real tabs, search and table
 * chrome with the table's own skeleton rows. */
const MembersSkeleton = ({
  orgSlug,
  officeSlug,
}: {
  orgSlug: string;
  officeSlug: string;
}) => (
  <div className="space-y-2">
    <div className={STICKY_TOOLBAR_CLASS}>
      <OfficeTabNav
        orgSlug={orgSlug}
        officeSlug={officeSlug}
        searchValue=""
        onSearchChange={noop}
        searchPlaceholder="Search members..."
      />
    </div>
    <MembersTable
      rows={[]}
      isLoading
      config={{
        subEntityLabel: "Projects",
        showSubEntityColumn: false,
        showSubEntityFilter: false,
        canManageMembers: false,
        // Offices always show the access filter (see useMembersSection).
        showAccessFilter: true,
      }}
    />
  </div>
);
