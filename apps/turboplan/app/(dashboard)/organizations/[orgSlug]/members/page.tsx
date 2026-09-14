import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { InviteMembersProvider } from "@/components/dashboard/invite-members-context";
import { OrgBannerActions } from "@/components/dashboard/org-banner-actions";
import { OrgMembersSection } from "@/components/dashboard/org-members-section";
import { StickyEntityBanner } from "@/components/dashboard/sticky-entity-banner";
import { DashboardProvider } from "@/components/providers/dashboard-provider";
import { SidebarOrgRegistrar } from "@/components/sidebar/sidebar-org-registrar";
import {
  canReadOrganizationAsMember,
  getCachedSession,
  getValidatedOrganizationBySlug,
} from "@/lib/cache/dashboard";
import { AppUrls } from "@/lib/nav/urls";
import type { OrganizationPageProps } from "@/types/dashboard";

export async function generateMetadata({
  params,
}: OrganizationPageProps): Promise<Metadata> {
  try {
    const session = await getCachedSession();
    const resolvedParams = await params;

    if (!session?.user?.id) {
      return { title: "Dashboard" };
    }

    const { data: organization } = await getValidatedOrganizationBySlug(
      session.user.id,
      resolvedParams.orgSlug,
    );

    if (!organization) {
      return {
        title: "Access Restricted",
        description: "You do not have access to this resource",
      };
    }

    return {
      title: `Members - ${organization.name}`,
      description: `Manage members of ${organization.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function OrganizationMembersPage({
  params,
}: OrganizationPageProps) {
  const session = await getCachedSession();
  const resolvedParams = await params;

  if (!session?.user?.id) {
    redirect(AppUrls.login);
  }

  let organization;
  try {
    const { data } = await getValidatedOrganizationBySlug(
      session.user.id,
      resolvedParams.orgSlug,
    );
    organization = data;
  } catch (error) {
    console.error("Error fetching organization:", error);
    return (
      <AccessError
        type="organization"
        message="Could not load organization data."
      />
    );
  }

  if (!organization) {
    return <AccessError type="organization" />;
  }

  // The org dashboard is viewable by any authenticated user for government orgs,
  // but the management surfaces are member-only. Gate here so non-members get a
  // clean access screen (and no tabs) instead of a client-side 403 retry loop.
  if (!(await canReadOrganizationAsMember(session.user.id, organization.id))) {
    return (
      <AccessError
        type="organization"
        message="You do not have access to this organization's members."
      />
    );
  }

  const breadcrumbs = [
    { label: organization.name, href: `/organizations/${organization.slug}` },
    { label: "Members", isActive: true },
  ];

  return (
    <DashboardProvider organization={organization}>
      <InviteMembersProvider>
        <SidebarOrgRegistrar />
        <div className="flex flex-col shrink-0 min-h-screen">
          <DashboardHeader breadcrumbs={breadcrumbs} />
          <StickyEntityBanner
            logoUrl={organization.logoUrl}
            title={organization.name}
            description={organization.description}
            actions={<OrgBannerActions organization={organization} />}
          />
          <div className="flex-1 container mx-auto px-6">
            <OrgMembersSection
              user={session.user}
              organization={organization}
              orgSlug={organization.slug}
            />
          </div>
        </div>
      </InviteMembersProvider>
    </DashboardProvider>
  );
}
