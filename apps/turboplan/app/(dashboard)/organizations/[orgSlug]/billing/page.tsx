import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { isBillingPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

import { AccessError } from "@/components/access-error";
import { BillingSettingsSection } from "@/components/billing/billing-settings-section";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { OrgBannerActions } from "@/components/dashboard/org-banner-actions";
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

interface BillingPageProps extends OrganizationPageProps {
  searchParams: Promise<{ checkout?: string }>;
}

export async function generateMetadata({
  params,
}: BillingPageProps): Promise<Metadata> {
  try {
    const session = await getCachedSession();
    const resolvedParams = await params;

    if (!session?.user?.id) {
      return { title: "Billing" };
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
      title: `Billing - ${organization.name}`,
      description: `Billing for ${organization.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function OrganizationBillingPage({
  params,
  searchParams,
}: BillingPageProps) {
  if (!isBillingPackageEnabled()) {
    notFound();
  }

  const session = await getCachedSession();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

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

  // Billing is member-only; gate to hide the management tabs/contents from
  // non-members (government orgs are otherwise readable by any authed user).
  if (!(await canReadOrganizationAsMember(session.user.id, organization.id))) {
    return <AccessError type="organization" />;
  }

  const breadcrumbs = [
    { label: organization.name, href: `/organizations/${organization.slug}` },
    { label: "Billing", isActive: true },
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
          <BillingSettingsSection
            userId={session.user.id}
            organizationId={organization.id}
            orgSlug={organization.slug}
            checkoutSucceeded={resolvedSearchParams.checkout === "success"}
          />
        </div>
      </div>
    </DashboardProvider>
  );
}
