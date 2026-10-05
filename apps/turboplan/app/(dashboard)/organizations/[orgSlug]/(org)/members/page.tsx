import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { OrgMembersSection } from "@/components/dashboard/org-members-section";
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
      return { title: "Dashboard" };
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
      title: `Members - ${organization.name}`,
      description: `Manage members of ${organization.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function OrganizationMembersPage({
  params,
}: OrganizationPageProps) {
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

  // The org dashboard is viewable by any authenticated user for government orgs,
  // but the management surfaces are member-only. Gate here so non-members get a
  // clean access screen (and no tabs) instead of a client-side 403 retry loop.
  if (!(await canReadOrganizationAsMember(session.user.id, organization.id))) {
    return (
      <AccessError
        type="organization"
        message="You do not have access to this organization's members."
      />
    );
  }

  return (
    <OrgMembersSection
      user={session.user}
      organization={organization}
      orgSlug={organization.slug}
    />
  );
}
