import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PaymentFailedBanner } from "@/components/billing/payment-failed-banner";
import { OfficesSection } from "@/components/dashboard/offices-section";
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

  // The tabs layout already resolved the org and rendered any access error.
  const { data: organization } = await getValidatedOrganizationBySlug(
    session.user.id,
    resolvedParams.orgSlug,
  );

  if (!organization) {
    return null;
  }

  const isMember = await canReadOrganizationAsMember(
    session.user.id,
    organization.id,
  );

  return (
    <>
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
    </>
  );
}
