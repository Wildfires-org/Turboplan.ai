import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { OfficePageFrame } from "@/components/dashboard/office-page-frame";
import { ProjectsCardSection } from "@/components/dashboard/projects-card-section";
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
        title: "Office Dashboard",
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
      title: `${office.name} - ${organization.name}`,
      description: `Manage projects in ${office.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function OfficeDashboardPage({
  params,
  searchParams,
}: OfficePageProps & {
  searchParams: Promise<{ "create-project"?: string }>;
}) {
  const session = (await getCachedSession()) as AuthSession;
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const autoOpenCreateProject =
    resolvedSearchParams["create-project"] === "true";

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
      tab="projects"
    >
      <ProjectsCardSection
        user={session.user}
        organizationSlug={organization.slug}
        officeSlug={office.slug}
        autoOpenCreateProject={autoOpenCreateProject}
      />
    </OfficePageFrame>
  );
}
