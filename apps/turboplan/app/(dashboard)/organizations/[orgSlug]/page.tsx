import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { PaymentFailedBanner } from "@/components/billing/payment-failed-banner";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { OfficesSection } from "@/components/dashboard/offices-section";
import { OrgBannerActions } from "@/components/dashboard/org-banner-actions";
import { StickyEntityBanner } from "@/components/dashboard/sticky-entity-banner";
import { DashboardProvider } from "@/components/providers/dashboard-provider";
import { SidebarOrgRegistrar } from "@/components/sidebar/sidebar-org-registrar";
import {
  canReadOrganizationAsMember,
  getCachedSession,
  getValidatedOrganizationBySlug,
} from "@/lib/cache/dashboard";
import type { OrganizationPageProps } from "@/types/dashboard";

export async function generateMetadata({
  params,
}: OrganizationPageProps): Promise<Metadata> {
  try {
    const session = await getCachedSession();
    const resolvedParams = await params;

    if (!session?.user?.id) {
      return {
        title: "Dashboard",
      };
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
      title: `${organization.name} - Dashboard`,
      description: `Manage projects and settings for ${organization.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function OrganizationDashboardPage({
  params,
}: OrganizationPageProps) {
  const session = await getCachedSession();
  const resolvedParams = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get organization with access validation using slug
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

  // Government orgs are readable by any authenticated user, so the overview
  // stays viewable for non-members. Member-only tabs are hidden by passing the
  // membership flag to the tab nav below.
  const isMember = await canReadOrganizationAsMember(
    session.user.id,
    organization.id,
  );

  // Create breadcrumbs with organization name
  const breadcrumbs = [{ label: organization.name, isActive: true }];

  return (
    <DashboardProvider organization={organization}>
      <SidebarOrgRegistrar />
      <div className="flex flex-col shrink-0 min-h-screen">
        <DashboardHeader breadcrumbs={breadcrumbs} />
        <StickyEntityBanner
          logoUrl={organization.logoUrl}
          title={organization.name}
          description={organization.description}
          actions={
            <OrgBannerActions organization={organization} isMember={isMember} />
          }
        />
        <div className="flex-1 container mx-auto px-6">
          <PaymentFailedBanner
            organizationId={organization.id}
            orgSlug={organization.slug}
            userId={session.user.id}
          />
          <OfficesSection
            user={session.user}
            organizationId={organization.id}
            organizationSlug={organization.slug}
            organizationName={organization.name}
            isMember={isMember}
          />
        </div>
      </div>
    </DashboardProvider>
  );
}
