import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { OfficePageFrame } from "@/components/dashboard/office-page-frame";
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

  return (
    <OfficePageFrame
      organization={organization}
      office={office}
      userId={session.user.id}
      tab="templates"
    >
      <TemplatesGridSection
        organizationSlug={organization.slug}
        officeSlug={office.slug}
      />
    </OfficePageFrame>
  );
}
