"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import {
  ArrowLeftRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";

import { cn } from "@wildfires-org/turboplan-utils";
import type { OrganizationWithOffices } from "@wildfires-org/turboplan-workspace/types";

import { OrgAvatar } from "../org-avatar";

interface SidebarOrgOfficeSearchProps {
  organizations: OrganizationWithOffices[];
  currentOrgSlug?: string;
  currentOfficeSlug?: string;
  onOfficeSelect: (orgSlug: string, officeSlug: string) => void;
  onOrgSelect: (orgSlug: string) => void;
  listClassName?: string;
  /**
   * When true, organizations without any offices are rendered disabled with a
   * hint and cannot be selected. Used by the submit-application flow, where a
   * project can only be accepted into a specific office of the target org.
   * Defaults to false so sidebar navigation can still switch to office-less orgs.
   */
  requireOffice?: boolean;
}

export function SidebarOrgOfficeSearch({
  organizations,
  currentOrgSlug,
  currentOfficeSlug,
  onOfficeSelect,
  onOrgSelect,
  listClassName,
  requireOffice = false,
}: SidebarOrgOfficeSearchProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);

  // Expand current org by default
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (currentOrgSlug) {
      const currentOrg = organizations.find((o) => o.slug === currentOrgSlug);
      if (currentOrg) initial.add(currentOrg.id);
    }
    return initial;
  });

  // Auto-focus search input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  const toggleOrg = (orgId: string) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  // Offices the user cannot open are hidden entirely — clicking one would
  // only land on an access-restricted page (government org offices are
  // always accessible, so this only affects private orgs).
  const accessibleOrganizations = useMemo(
    () =>
      organizations.map((org) => ({
        ...org,
        offices: org.offices.filter((office) => office.hasAccess),
      })),
    [organizations],
  );

  // Filter organizations and offices by search query
  const filtered = useMemo(() => {
    const q = deferredQuery.toLowerCase().trim();
    if (!q) return accessibleOrganizations;

    return accessibleOrganizations
      .map((org) => {
        const orgNameMatches =
          org.name.toLowerCase().includes(q) ||
          (org.shortName?.toLowerCase().includes(q) ?? false);
        const matchingOffices = org.offices.filter((office) =>
          office.name.toLowerCase().includes(q),
        );

        if (orgNameMatches) return org;
        if (matchingOffices.length > 0) {
          return { ...org, offices: matchingOffices };
        }
        return null;
      })
      .filter(Boolean) as OrganizationWithOffices[];
  }, [accessibleOrganizations, deferredQuery]);

  // When searching, auto-expand all filtered orgs
  const effectiveExpandedOrgs = useMemo(() => {
    if (deferredQuery.trim()) {
      return new Set(filtered.map((o) => o.id));
    }
    return expandedOrgs;
  }, [deferredQuery, filtered, expandedOrgs]);

  return (
    <div className="flex flex-col">
      {/* Search input — h-[34px] per Figma */}
      <div className="flex h-[34px] items-center gap-3 px-3 pr-4">
        <Search className="size-[19px] shrink-0 text-neutral-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-xs leading-4 tracking-[0.12px] text-gray-900 placeholder:text-gray-600 outline-none"
        />
      </div>

      {/* Separator — py-[6px] per Figma */}
      <div className="py-1.5 pr-2">
        <div className="h-px bg-gray-200" />
      </div>

      {/* Org & office list */}
      <div
        className={cn(
          "flex flex-col gap-2 max-h-[60vh] overflow-y-auto",
          listClassName,
        )}
      >
        {filtered.length === 0 && (
          <p className="px-3 pr-4 py-4 text-sm text-gray-500 text-center">
            No organizations or offices found
          </p>
        )}

        {filtered.map((org, index) => {
          const isExpanded = effectiveExpandedOrgs.has(org.id);
          const isCurrentOrg = org.slug === currentOrgSlug;
          const hasOffices = org.offices.length > 0;
          // Office-less orgs are invalid submit targets: a project can only be
          // accepted into an office, so they are disabled when requireOffice.
          const isOfficeless = requireOffice && !hasOffices;

          return (
            <div key={org.id} className="flex flex-col">
              {/* Org header — px-3 py-1.5 per Figma */}
              <div className="group/org flex h-[38px] w-full items-center gap-2 rounded-md px-3 pr-4">
                <button
                  type="button"
                  onClick={() => hasOffices && toggleOrg(org.id)}
                  disabled={isOfficeless}
                  className={cn(
                    "flex flex-1 items-center gap-2 min-w-0 transition-colors",
                    hasOffices ? "cursor-pointer" : "cursor-default",
                    isOfficeless && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <OrgAvatar
                    name={org.name}
                    logoUrl={org.logoUrl}
                    className={cn(
                      "size-[35px] shrink-0 rounded border",
                      isCurrentOrg ? "border-[#1b845c]" : "border-gray-100",
                    )}
                  />
                  <span
                    className="text-sm text-gray-900 truncate"
                    title={org.name}
                  >
                    {org.name}
                  </span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {isOfficeless ? (
                    <span className="text-xs font-medium leading-4 tracking-[0.24px] text-neutral-400">
                      No offices available
                    </span>
                  ) : isCurrentOrg ? (
                    <span className="text-xs font-medium leading-4 tracking-[0.24px] text-[#1b845c]">
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOrgSelect(org.slug);
                      }}
                      className="rounded p-0.5 opacity-0 group-hover/org:opacity-100 transition-opacity hover:bg-gray-100"
                      title={`Switch to ${org.name}`}
                    >
                      <ArrowLeftRight className="size-[16px] text-neutral-400" />
                    </button>
                  )}
                  {hasOffices &&
                    (isExpanded ? (
                      <button
                        type="button"
                        onClick={() => toggleOrg(org.id)}
                        className="rounded p-0.5 hover:bg-gray-100 transition-colors"
                      >
                        <ChevronUp className="size-[19px] shrink-0 text-neutral-400" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleOrg(org.id)}
                        className="rounded p-0.5 hover:bg-gray-100 transition-colors"
                      >
                        <ChevronDown className="size-[19px] shrink-0 text-neutral-400" />
                      </button>
                    ))}
                </div>
              </div>

              {/* Office list */}
              {isExpanded && hasOffices && (
                <div className="flex flex-col">
                  {org.offices.map((office) => {
                    const isCurrent =
                      isCurrentOrg && office.slug === currentOfficeSlug;

                    return (
                      <button
                        key={office.id}
                        type="button"
                        onClick={() => {
                          if (!isCurrent) {
                            onOfficeSelect(org.slug, office.slug);
                          }
                        }}
                        className={cn(
                          "group/office flex w-full items-center gap-2 rounded-md px-3 pr-4 py-2.5 text-left transition-colors",
                          isCurrent ? "bg-gray-100" : "hover:bg-gray-50",
                        )}
                      >
                        {/* Left gutter aligns office name with org name; green ✓✓ marks the active office */}
                        <span className="flex size-[35px] shrink-0 items-center justify-center">
                          {isCurrent && (
                            <CheckCheck className="size-[19px] text-[#1b845c]" />
                          )}
                        </span>

                        <span
                          className="flex-1 text-sm text-gray-900 truncate"
                          title={office.name}
                        >
                          {office.name}
                        </span>

                        {!isCurrent && (
                          <span className="flex items-center gap-[5px] opacity-0 group-hover/office:opacity-100 transition-opacity">
                            <Check className="size-[19px] text-[#1489FF]" />
                            <span className="text-xs font-medium leading-4 tracking-[0.24px] text-[#1489FF]">
                              Switch
                            </span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Separator after expanded org or between collapsed orgs */}
              {index < filtered.length - 1 && (
                <div className="py-3 pr-2">
                  <div className="h-px bg-gray-200" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
