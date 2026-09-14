import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { InviteMembersProvider } from "@/components/dashboard/invite-members-context";
import { OfficeBannerActions } from "@/components/dashboard/office-banner-actions";
import { OfficeMembersSection } from "@/components/dashboard/office-members-section";
import { StickyEntityBanner } from "@/components/dashboard/sticky-entity-banner";
import { SidebarOfficeRegistrar } from "@/components/sidebar/sidebar-office-registrar";
import {
  getCachedSession,
  getValidatedOfficeBySlug,
} from "@/lib/cache/dashboard";
import { AppUrls } from "@/lib/nav/urls";
import type { OfficePageProps } from "@/types/dashboard";

export async function generateMetadata({
  params,
}: OfficePageProps): Promise<Metadata> {
  try {
    const session = await getCachedSession();
    const resolvedParams = await params;

    if (!session?.user?.id) {
      return { title: "Office Dashboard" };
    }

    const { data } = await getValidatedOfficeBySlug(
      session.user.id,
      resolvedParams.orgSlug,
      resolvedParams.officeSlug,
    );

    if (!data) {
      return {
        title: "Access Restricted",
        description: "You do not have access to this resource",
      };
    }

    const { organization, office } = data;

    return {
      title: `Members - ${office.name} - ${organization.name}`,
      description: `Manage members of ${office.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function OfficeMembersPage({ params }: OfficePageProps) {
  const session = await getCachedSession();
  const resolvedParams = await params;

  if (!session?.user?.id) {
    redirect(AppUrls.login);
  }

  let data;
  try {
    const result = await getValidatedOfficeBySlug(
      session.user.id,
      resolvedParams.orgSlug,
      resolvedParams.officeSlug,
    );
    data = result.data;
  } catch (error) {
    console.error("Error fetching office data:", error);
    return <AccessError type="office" message="Could not load office data." />;
  }

  if (!data) {
    return <AccessError type="office" />;
  }

  const { organization, office } = data;

  const breadcrumbs = [
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
    { label: "Members", isActive: true },
  ];

  return (
    <InviteMembersProvider>
      <SidebarOfficeRegistrar />
      <div className="flex flex-col shrink-0 min-h-screen">
        <DashboardHeader breadcrumbs={breadcrumbs} userId={session.user.id} />
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
        <div className="flex-1 container mx-auto px-6">
          <OfficeMembersSection
            user={session.user}
            office={office}
            orgSlug={organization.slug}
            officeSlug={office.slug}
          />
        </div>
      </div>
    </InviteMembersProvider>
  );
}
