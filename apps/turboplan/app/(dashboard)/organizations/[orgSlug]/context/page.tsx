import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { isProjectContextPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

import { AccessError } from "@/components/access-error";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { OrgBannerActions } from "@/components/dashboard/org-banner-actions";
import { StickyEntityBanner } from "@/components/dashboard/sticky-entity-banner";
import { OrganizationContextSection } from "@/components/organization-context/organization-context-section";
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
      return { title: "Context" };
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
      title: `Context - ${organization.name}`,
      description: `What the AI knows about ${organization.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function OrganizationContextPage({
  params,
}: OrganizationPageProps) {
  if (!isProjectContextPackageEnabled()) {
    notFound();
  }

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

  // Organization READ, the same check as the context API (members, plus
  // collaborators on its projects). Government orgs are otherwise readable by
  // any authenticated user; their context is not.
  if (!(await canReadOrganizationAsMember(session.user.id, organization.id))) {
    return <AccessError type="organization" />;
  }

  const breadcrumbs = [
    { label: organization.name, href: AppUrls.organization(organization.slug) },
    { label: "Context", isActive: true },
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
          <OrganizationContextSection
            userId={session.user.id}
            organizationId={organization.id}
            organizationName={organization.name}
            orgSlug={organization.slug}
          />
        </div>
      </div>
    </DashboardProvider>
  );
}
