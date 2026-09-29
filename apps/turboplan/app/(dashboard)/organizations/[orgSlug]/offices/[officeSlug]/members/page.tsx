import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { InviteMembersProvider } from "@/components/dashboard/invite-members-context";
import { OfficeMembersSection } from "@/components/dashboard/office-members-section";
import { OfficePageFrame } from "@/components/dashboard/office-page-frame";
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

  return (
    <InviteMembersProvider>
      <OfficePageFrame
        organization={organization}
        office={office}
        userId={session.user.id}
        tab="members"
      >
        <OfficeMembersSection
          user={session.user}
          office={office}
          orgSlug={organization.slug}
          officeSlug={office.slug}
        />
      </OfficePageFrame>
    </InviteMembersProvider>
  );
}
