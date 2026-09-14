"use client";

import { Building2, CreditCard, FileSignature, Users } from "lucide-react";

import {
  isBillingPackageEnabled,
  isSigningPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";

import { TabNav } from "@/components/dashboard/tab-nav";
import { AppUrls } from "@/lib/nav/urls";

type OrgTabNavProps = {
  orgSlug: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /**
   * Whether the current user is a member of the organization. Government orgs
   * are viewable by any authenticated user, but the management tabs (Members,
   * Signing, Billing) are member-only and hidden for non-members.
   * Defaults to true since the pages that render those tabs already gate access.
   */
  isMember?: boolean;
};

export function OrgTabNav({
  orgSlug,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  isMember = true,
}: OrgTabNavProps) {
  const tabs = [
    {
      key: "offices",
      label: "Offices",
      icon: Building2,
      href: AppUrls.organization(orgSlug),
    },
    ...(isMember
      ? [
          {
            key: "members",
            label: "Members",
            icon: Users,
            href: AppUrls.organizationMembers(orgSlug),
          },
          ...(isSigningPackageEnabled()
            ? [
                {
                  key: "signing",
                  label: "Signing",
                  icon: FileSignature,
                  href: AppUrls.organizationSigning(orgSlug),
                },
              ]
            : []),
          ...(isBillingPackageEnabled()
            ? [
                {
                  key: "billing",
                  label: "Billing",
                  icon: CreditCard,
                  href: AppUrls.organizationBilling(orgSlug),
                },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <TabNav
      tabs={tabs}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
    />
  );
}
