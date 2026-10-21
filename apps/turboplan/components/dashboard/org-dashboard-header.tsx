"use client";

import { usePathname } from "next/navigation";

import type { ClientOrganization } from "@wildfires-org/turboplan-workspace/types";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { isActiveLink } from "@/lib/nav/activeLink";
import { AppUrls } from "@/lib/nav/urls";

interface OrgDashboardHeaderProps {
  organization: ClientOrganization;
}

/** Breadcrumbs for the organization tabs. Lives in the shared org layout, so
 * the active tab comes from the URL rather than from each page. */
export function OrgDashboardHeader({ organization }: OrgDashboardHeaderProps) {
  const pathname = usePathname();

  const tabLabel = [
    { href: AppUrls.organizationMembers(organization.slug), label: "Members" },
    {
      href: AppUrls.organizationSigning(organization.slug),
      label: "My Signatures",
    },
    { href: AppUrls.organizationBilling(organization.slug), label: "Billing" },
  ].find((tab) => isActiveLink(pathname, tab.href))?.label;

  const breadcrumbs = tabLabel
    ? [
        {
          label: organization.name,
          href: AppUrls.organization(organization.slug),
        },
        { label: tabLabel, isActive: true },
      ]
    : [{ label: organization.name, isActive: true }];

  return <DashboardHeader breadcrumbs={breadcrumbs} />;
}
