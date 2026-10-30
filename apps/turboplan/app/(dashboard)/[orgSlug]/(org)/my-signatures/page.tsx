import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { isSigningPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import { MySignaturesPage } from "@wildfires-org/turboplan-signing/client";

import { AccessError } from "@/components/access-error";
import { OrgTabNav } from "@/components/dashboard/org-tab-nav";
import {
  canReadOrganizationAsMember,
  getCachedSession,
  getValidatedOrganizationBySlug,
} from "@/lib/cache/dashboard";
import { STICKY_TOOLBAR_CLASS } from "@/lib/glass";
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
      title: `My Signatures - ${organization.name}`,
      description: `Pending document signatures for ${organization.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function OrganizationMySignaturesPage({
  params,
}: OrganizationPageProps) {
  if (!isSigningPackageEnabled()) {
    notFound();
  }

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

  // Signing is member-only; gate to hide the management tabs/contents from
  // non-members (government orgs are otherwise readable by any authed user).
  if (!(await canReadOrganizationAsMember(session.user.id, organization.id))) {
    return <AccessError type="organization" />;
  }

  return (
    <div className="space-y-2">
      <div className={STICKY_TOOLBAR_CLASS}>
        <OrgTabNav orgSlug={organization.slug} />
      </div>
      <MySignaturesPage organizationId={organization.id} />
    </div>
  );
}
