import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UserRole } from "@wildfires-org/turboplan-db/types";

import { AccessError } from "@/components/access-error";
import { MySubmissionsSection } from "@/components/dashboard/my-submissions-section";
import { OfficePageFrame } from "@/components/dashboard/office-page-frame";
import {
  getCachedSession,
  getCachedUserProfile,
  getValidatedOfficeBySlug,
} from "@/lib/cache/dashboard";
import { AppUrls } from "@/lib/nav/urls";
import type { OfficePageProps } from "@/types/dashboard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: OfficePageProps): Promise<Metadata> {
  try {
    const session = await getCachedSession();
    const resolvedParams = await params;

    if (!session?.user?.id) {
      return { title: "My Submissions" };
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
      title: `My Submissions - ${office.name} - ${organization.name}`,
      description: `View your submissions for ${office.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function MySubmissionsPage({ params }: OfficePageProps) {
  const session = await getCachedSession();
  const resolvedParams = await params;

  if (!session?.user?.id) {
    redirect(AppUrls.login);
  }

  // Only citizens can access this page — redirect non-citizens to the office page
  const profile = await getCachedUserProfile(session.user.id);
  if (profile?.userRole !== UserRole.CITIZEN) {
    redirect(AppUrls.office(resolvedParams.orgSlug, resolvedParams.officeSlug));
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

  return (
    <OfficePageFrame
      organization={organization}
      office={office}
      userId={session.user.id}
      tab="my-submissions"
    >
      <MySubmissionsSection
        organizationSlug={organization.slug}
        officeSlug={office.slug}
      />
    </OfficePageFrame>
  );
}
