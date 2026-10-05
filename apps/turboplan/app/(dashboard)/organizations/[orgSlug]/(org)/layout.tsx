import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { InviteMembersProvider } from "@/components/dashboard/invite-members-context";
import { OrgBannerActions } from "@/components/dashboard/org-banner-actions";
import { OrgDashboardHeader } from "@/components/dashboard/org-dashboard-header";
import { StickyEntityBanner } from "@/components/dashboard/sticky-entity-banner";
import { DashboardProvider } from "@/components/providers/dashboard-provider";
import { SidebarOrgRegistrar } from "@/components/sidebar/sidebar-org-registrar";
import {
  canReadOrganizationAsMember,
  getCachedSession,
  getValidatedOrganizationBySlug,
} from "@/lib/cache/dashboard";
import { AppUrls } from "@/lib/nav/urls";

interface OrganizationTabsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

/**
 * Shared chrome for the organization tabs (Offices, Members, Signing,
 * Billing). Header and banner live here so switching tabs only swaps the
 * content below them; `loading.tsx` next to this file covers just that part.
 */
export default async function OrganizationTabsLayout({
  children,
  params,
}: OrganizationTabsLayoutProps) {
  const session = await getCachedSession();
  const { orgSlug } = await params;

  if (!session?.user?.id) {
    redirect(AppUrls.login);
  }

  let organization;
  try {
    const { data } = await getValidatedOrganizationBySlug(
      session.user.id,
      orgSlug,
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

  // Government orgs are readable by any authenticated user. Member-only tabs
  // and banner actions are hidden for non-members; their pages gate access.
  const isMember = await canReadOrganizationAsMember(
    session.user.id,
    organization.id,
  );

  return (
    <DashboardProvider organization={organization} isOrgMember={isMember}>
      <InviteMembersProvider>
        <SidebarOrgRegistrar />
        <div className="flex flex-col shrink-0 min-h-screen">
          <OrgDashboardHeader organization={organization} />
          <StickyEntityBanner
            logoUrl={organization.logoUrl}
            title={organization.name}
            description={organization.description}
            actions={
              <OrgBannerActions
                organization={organization}
                isMember={isMember}
              />
            }
          />
          <div className="flex-1 container mx-auto px-6">{children}</div>
        </div>
      </InviteMembersProvider>
    </DashboardProvider>
  );
}
