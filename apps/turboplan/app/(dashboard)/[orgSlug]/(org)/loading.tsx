"use client";

import { useParams, usePathname } from "next/navigation";

import { MySignaturesPage } from "@wildfires-org/turboplan-signing/client";

import { BillingSettingsSection } from "@/components/billing/billing-settings-section";
import { InertLoading } from "@/components/dashboard/inert-loading";
import { OfficesSection } from "@/components/dashboard/offices-section";
import { OrgMembersSection } from "@/components/dashboard/org-members-section";
import { OrgTabNav } from "@/components/dashboard/org-tab-nav";
import { useOptionalDashboard } from "@/components/providers/dashboard-provider";
import { useUser } from "@/components/providers/user-provider";
import { STICKY_TOOLBAR_CLASS } from "@/lib/glass";
import { isActiveLink } from "@/lib/nav/activeLink";
import { AppUrls } from "@/lib/nav/urls";

/**
 * Loading state for switching organization tabs. The header and banner stay
 * mounted in the tabs layout; this renders the target tab's real section,
 * whose own placeholders mirror its rows and cards, so only the content below
 * the tabs loads.
 */
export default function OrganizationTabLoading() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const pathname = usePathname();
  const dashboard = useOptionalDashboard();
  const { user } = useUser();

  const organization = dashboard?.organization;

  const userId = user?.id;

  if (!organization || !user || !userId) {
    return null;
  }

  const renderSection = () => {
    if (isActiveLink(pathname, AppUrls.organizationMembers(orgSlug))) {
      return (
        <OrgMembersSection
          user={user}
          organization={organization}
          orgSlug={orgSlug}
        />
      );
    }
    if (isActiveLink(pathname, AppUrls.organizationBilling(orgSlug))) {
      return (
        <BillingSettingsSection
          userId={userId}
          organizationId={organization.id}
          orgSlug={orgSlug}
        />
      );
    }
    if (isActiveLink(pathname, AppUrls.organizationSigning(orgSlug))) {
      return (
        <div className="space-y-2">
          <div className={STICKY_TOOLBAR_CLASS}>
            <OrgTabNav orgSlug={orgSlug} />
          </div>
          <MySignaturesPage organizationId={organization.id} />
        </div>
      );
    }
    return (
      <OfficesSection
        user={user}
        organizationId={organization.id}
        organizationSlug={orgSlug}
        organizationName={organization.name}
        isMember={dashboard.isOrgMember}
      />
    );
  };

  return <InertLoading>{renderSection()}</InertLoading>;
}
