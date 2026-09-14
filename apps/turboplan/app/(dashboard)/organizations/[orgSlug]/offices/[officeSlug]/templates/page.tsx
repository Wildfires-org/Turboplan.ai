import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { TemplatesGridSection } from "@/components/dashboard/templates-grid-section";
import {
  getCachedSession,
  getValidatedOfficeBySlug,
} from "@/lib/cache/dashboard";
import { AppUrls } from "@/lib/nav/urls";
import type { AuthSession } from "@/lib/types/auth";
import type { OfficePageProps } from "@/types/dashboard";

export async function generateMetadata({
  params,
}: OfficePageProps): Promise<Metadata> {
  try {
    const session = await getCachedSession();
    const resolvedParams = await params;

    if (!session?.user?.id) {
      return {
        title: "Project Templates",
      };
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
      title: `${office.name} Templates - ${organization.name}`,
      description: `Manage project templates in ${office.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function TemplatesPage({ params }: OfficePageProps) {
  const session = (await getCachedSession()) as AuthSession;
  const resolvedParams = await params;

  if (!session?.user?.id) {
    redirect(AppUrls.login);
  }

  // Get office data with full access validation using slugs
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

  // Create breadcrumbs with organization, office, and templates
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
    {
      label: "Templates",
      isActive: true,
    },
  ];

  return (
    <div className="flex flex-col shrink-0 min-h-screen">
      <DashboardHeader breadcrumbs={breadcrumbs} userId={session.user.id} />
      <div className="flex-1 container mx-auto p-6">
        <TemplatesGridSection
          organizationSlug={organization.slug}
          officeSlug={office.slug}
        />
      </div>
    </div>
  );
}
