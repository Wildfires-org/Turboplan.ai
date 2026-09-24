import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MySignaturesPage } from "@wildfires-org/turboplan-signing/client";

import { AccessError } from "@/components/access-error";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { OrgBannerActions } from "@/components/dashboard/org-banner-actions";
import { OrgTabNav } from "@/components/dashboard/org-tab-nav";
import { StickyEntityBanner } from "@/components/dashboard/sticky-entity-banner";
import { DashboardProvider } from "@/components/providers/dashboard-provider";
import { SidebarOrgRegistrar } from "@/components/sidebar/sidebar-org-registrar";
import {
  canReadOrganizationAsMember,
  getCachedSession,
  getValidatedOrganizationBySlug,
} from "@/lib/cache/dashboard";
import { STICKY_TOOLBAR_CLASS } from "@/lib/glass";
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
      title: `My Signatures - ${organization.name}`,
      description: `Pending document signatures for ${organization.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function OrganizationMySignaturesPage({
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

  // Signing is member-only; gate to hide the management tabs/contents from
  // non-members (government orgs are otherwise readable by any authed user).
  if (!(await canReadOrganizationAsMember(session.user.id, organization.id))) {
    return <AccessError type="organization" />;
  }

  const breadcrumbs = [
    { label: organization.name, href: `/organizations/${organization.slug}` },
    { label: "My Signatures", isActive: true },
  ];

  return (
    <DashboardProvider organization={organization}>
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
          <div className={STICKY_TOOLBAR_CLASS}>
            <OrgTabNav orgSlug={organization.slug} />
          </div>
          <MySignaturesPage organizationId={organization.id} />
        </div>
      </div>
    </DashboardProvider>
  );
}
