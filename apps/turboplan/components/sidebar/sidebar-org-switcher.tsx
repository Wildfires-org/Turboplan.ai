"use client";

import { useMemo, useState } from "react";

import { Building2, ChevronsUpDown } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import {
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@wildfires-org/turboplan-utils";

import { useOffices } from "@/hooks/use-offices";
import { useUserOrganizations } from "@/hooks/use-organization";
import { useOrganizationsWithOffices } from "@/hooks/use-organizations-with-offices";
import { AppUrls } from "@/lib/nav/urls";
import { OrgAvatar } from "../org-avatar";
import { SidebarOrgOfficeSearch } from "./sidebar-org-office-search";

export function SidebarOrgSwitcher() {
  const params = useParams<{ orgSlug?: string; officeSlug?: string }>();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Current org/office display (works for any org type)
  const { organizations: userOrgs, isLoading: isLoadingOrgs } =
    useUserOrganizations();
  const currentOrg = useMemo(
    () => userOrgs.find((org) => org.slug === params.orgSlug),
    [userOrgs, params.orgSlug],
  );

  const { offices, isLoading: isLoadingOffices } = useOffices({
    organizationSlug: params.orgSlug ?? null,
  });
  const currentOffice = useMemo(
    () => offices.find((office) => office.slug === params.officeSlug),
    [offices, params.officeSlug],
  );

  // Dropdown data (all government orgs with offices)
  const { organizations: dropdownOrgs } = useOrganizationsWithOffices();

  const isLoading = isLoadingOrgs || (params.officeSlug && isLoadingOffices);
  const displayName = currentOffice?.name ?? currentOrg?.name;

  const handleOfficeSelect = (orgSlug: string, officeSlug: string) => {
    setOpen(false);
    router.push(AppUrls.office(orgSlug, officeSlug));
  };

  const handleOrgSelect = (orgSlug: string) => {
    setOpen(false);
    router.push(AppUrls.organization(orgSlug));
  };

  if (isLoading) {
    return (
      <div className="flex h-11 items-center gap-3 rounded-lg border border-brandAlt-200 bg-white p-2">
        <div className="size-7 shrink-0 animate-pulse rounded bg-brandAlt-200" />
        <div className="h-4 flex-1 animate-pulse rounded bg-neutral-300 group-data-[collapsible=icon]:hidden" />
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-11 w-full items-center gap-3 overflow-hidden rounded-lg border border-brandAlt-200 bg-white p-2",
            "transition-colors duration-200 hover:bg-brandAlt-100",
            "group-data-[collapsible=icon]:justify-center",
          )}
        >
          {currentOrg ? (
            <OrgAvatar
              name={currentOrg.name}
              logoUrl={currentOrg.logoUrl}
              className="size-7 shrink-0 rounded border border-white shadow-sm"
            />
          ) : (
            <Building2 className="size-7 shrink-0 rounded bg-brand-800 p-1.5 text-white" />
          )}
          <span
            className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-sm font-medium text-gray-900 group-data-[collapsible=icon]:hidden"
            title={displayName}
          >
            {displayName ?? "Select workspace"}
          </span>
          <ChevronsUpDown className="ml-auto size-5 shrink-0 text-brand-800 group-data-[collapsible=icon]:hidden" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={4}
        className="w-[276px] py-2 pl-2 pr-0"
      >
        <SidebarOrgOfficeSearch
          organizations={dropdownOrgs}
          currentOrgSlug={params.orgSlug}
          currentOfficeSlug={params.officeSlug}
          onOfficeSelect={handleOfficeSelect}
          onOrgSelect={handleOrgSelect}
          showMembershipFilter
        />
      </PopoverContent>
    </Popover>
  );
}
