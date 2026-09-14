"use client";

import { useMemo } from "react";

import { ChevronsUpDown } from "lucide-react";

import {
  cn,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@wildfires-org/turboplan-utils";
import type { OrganizationWithOffices } from "@wildfires-org/turboplan-workspace/types";

import { OrgAvatar } from "@/components/org-avatar";
import { SidebarOrgOfficeSearch } from "@/components/sidebar/sidebar-org-office-search";

interface OrgOfficeSelectorProps {
  organizations: OrganizationWithOffices[];
  isLoading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOrgSlug: string;
  selectedOfficeSlug: string;
  onOfficeSelect: (orgSlug: string, officeSlug: string) => void;
  onOrgSelect: (orgSlug: string) => void;
}

export function OrgOfficeSelector({
  organizations,
  isLoading,
  open,
  onOpenChange,
  selectedOrgSlug,
  selectedOfficeSlug,
  onOfficeSelect,
  onOrgSelect,
}: OrgOfficeSelectorProps) {
  const selectedOrg = useMemo(
    () => organizations.find((o) => o.slug === selectedOrgSlug),
    [organizations, selectedOrgSlug],
  );
  const selectedOffice = useMemo(
    () => selectedOrg?.offices.find((o) => o.slug === selectedOfficeSlug),
    [selectedOrg, selectedOfficeSlug],
  );

  return (
    <div className="space-y-1.5">
      <Label>Organization / Office</Label>
      <Popover open={open} onOpenChange={onOpenChange} modal>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-2",
              "transition-colors hover:bg-gray-100",
            )}
          >
            {selectedOrg ? (
              <>
                <OrgAvatar
                  name={selectedOrg.name}
                  logoUrl={selectedOrg.logoUrl}
                  className="size-[35px] shrink-0 rounded border border-gray-100 shadow-sm"
                />
                <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-gray-900">
                  {selectedOffice?.name ?? selectedOrg.name}
                </span>
              </>
            ) : isLoading && selectedOfficeSlug ? (
              <span className="min-w-0 flex-1 text-left text-sm text-gray-400 py-1.5 pl-1">
                Loading...
              </span>
            ) : (
              <span className="min-w-0 flex-1 text-left text-sm text-gray-400 py-1.5 pl-1">
                Select an office...
              </span>
            )}
            <ChevronsUpDown className="ml-auto size-4 shrink-0 text-gray-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={4}
          className="w-[var(--radix-popover-trigger-width)] rounded-lg border border-neutral-50 bg-neutral-50 py-2 pl-2 pr-0 shadow-[0px_20px_40px_rgba(0,7,26,0.08)]"
        >
          <SidebarOrgOfficeSearch
            organizations={organizations}
            currentOrgSlug={selectedOrgSlug}
            currentOfficeSlug={selectedOfficeSlug}
            onOfficeSelect={onOfficeSelect}
            onOrgSelect={onOrgSelect}
            listClassName="max-h-[30vh]"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
