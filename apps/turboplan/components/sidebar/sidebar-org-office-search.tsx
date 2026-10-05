"use client";

import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  ChevronDown,
  Search,
} from "lucide-react";
import { useLocalStorage } from "usehooks-ts";

import { cn, Switch } from "@wildfires-org/turboplan-utils";
import type { OrganizationWithOffices } from "@wildfires-org/turboplan-workspace/types";

import { OrgAvatar } from "../org-avatar";

const SEPARATOR_CLASS = "h-px shrink-0 bg-slate-900/[0.06] dark:bg-white/10";

const ICON_BUTTON_CLASS =
  "press flex size-7 items-center justify-center rounded-lg text-gray-550 hover:bg-brandAlt-100 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700";

export const ORG_MEMBERSHIP_FILTER_STORAGE_KEY =
  "turboplan-org-switcher-members-only";

/**
 * Narrows orgs (and their offices) to those matching a free-text query. Kept
 * standalone so the empty state can re-run it against the unfiltered catalog.
 */
const filterByQuery = (
  organizations: OrganizationWithOffices[],
  query: string,
) => {
  const q = query.toLowerCase().trim();
  if (!q) {
    return organizations;
  }

  return organizations
    .map((org) => {
      const orgNameMatches =
        org.name.toLowerCase().includes(q) ||
        (org.shortName?.toLowerCase().includes(q) ?? false);
      const matchingOffices = org.offices.filter((office) =>
        office.name.toLowerCase().includes(q),
      );

      if (orgNameMatches) {
        return org;
      }
      if (matchingOffices.length > 0) {
        return { ...org, offices: matchingOffices };
      }
      return null;
    })
    .filter(Boolean) as OrganizationWithOffices[];
};

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
  /**
   * When true, renders an "Only my organizations" toggle that hides orgs the
   * user has no RBAC membership in. Only the sidebar switcher wants this — the
   * submit-application and add-project flows exist to pick a government agency
   * the user is by definition *not* a member of, so they keep the full catalog.
   * Defaults to false.
   */
  showMembershipFilter?: boolean;
}

export function SidebarOrgOfficeSearch({
  organizations,
  currentOrgSlug,
  currentOfficeSlug,
  onOfficeSelect,
  onOrgSelect,
  listClassName,
  requireOffice = false,
  showMembershipFilter = false,
}: SidebarOrgOfficeSearchProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const membershipFilterId = useId();

  // `initializeWithValue: false` keeps the first render identical on server and
  // client (see `components/providers/ui-scale-provider.tsx`). The cost is that
  // the first client render reports the default — `true`, i.e. filtered — so a
  // user who turned the filter off sees a one-tick filtered -> unfiltered
  // settle. That direction is the safe one (we never flash orgs the user asked
  // to hide) and the popover mounts on open, so it is not worth more machinery.
  const [onlyMyOrgs, setOnlyMyOrgs] = useLocalStorage<boolean>(
    ORG_MEMBERSHIP_FILTER_STORAGE_KEY,
    true,
    { initializeWithValue: false },
  );
  const isMembershipFilterActive = showMembershipFilter && onlyMyOrgs;

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

  // Membership filter runs first, so the search box searches *within* the
  // user's own orgs. The currently-active org always survives the filter:
  // switching into a catalog org would otherwise make the switcher look like it
  // had lost its own selection.
  const membershipVisible = useMemo(() => {
    if (!isMembershipFilterActive) {
      return accessibleOrganizations;
    }
    return accessibleOrganizations.filter(
      (org) => org.isMember || org.slug === currentOrgSlug,
    );
  }, [accessibleOrganizations, isMembershipFilterActive, currentOrgSlug]);

  const hiddenCount = accessibleOrganizations.length - membershipVisible.length;

  // Filter organizations and offices by search query
  const filtered = useMemo(
    () => filterByQuery(membershipVisible, deferredQuery),
    [membershipVisible, deferredQuery],
  );

  // A query that matches nothing in the user's own orgs but would match in the
  // full catalog gets a pointer at the toggle rather than a bare "not found".
  const catalogOnlyMatches = useMemo(() => {
    if (filtered.length > 0 || hiddenCount === 0 || !deferredQuery.trim()) {
      return 0;
    }
    return filterByQuery(accessibleOrganizations, deferredQuery).length;
  }, [filtered.length, hiddenCount, deferredQuery, accessibleOrganizations]);

  // When searching, auto-expand all filtered orgs
  const effectiveExpandedOrgs = useMemo(() => {
    if (deferredQuery.trim()) {
      return new Set(filtered.map((o) => o.id));
    }
    return expandedOrgs;
  }, [deferredQuery, filtered, expandedOrgs]);

  return (
    <div className="flex flex-col">
      <label className="glass-inset flex h-9 items-center gap-2 rounded-xl px-3 focus-within:outline focus-within:outline-2 focus-within:outline-brand-700/40">
        <Search aria-hidden className="size-4 shrink-0 text-gray-550" />
        <input
          ref={inputRef}
          type="text"
          aria-label="Search organizations and offices"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-[13px] text-foreground placeholder:text-gray-550 focus:outline-none"
        />
      </label>

      <div className={cn(SEPARATOR_CLASS, "my-1.5")} />

      {/* Org & office list */}
      <div
        className={cn(
          "flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto",
          listClassName,
        )}
      >
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center">
            <p className="text-[13px] text-gray-550">
              No organizations or offices found
            </p>
            {catalogOnlyMatches > 0 && (
              <p className="mt-1 text-xs leading-4 text-gray-550">
                {catalogOnlyMatches === 1
                  ? "1 match is outside your organizations"
                  : `${catalogOnlyMatches} matches are outside your organizations`}{" "}
                — turn off "Only my organizations" to see{" "}
                {catalogOnlyMatches === 1 ? "it" : "them"}.
              </p>
            )}
          </div>
        )}

        {filtered.map((org, index) => {
          const isExpanded = effectiveExpandedOrgs.has(org.id);
          const isCurrentOrg = org.slug === currentOrgSlug;
          const hasOffices = org.offices.length > 0;
          // Office-less orgs are invalid submit targets: a project can only be
          // accepted into an office, so they are disabled when requireOffice.
          const isOfficeless = requireOffice && !hasOffices;

          return (
            <div key={org.id} className="flex flex-col gap-0.5">
              {index > 0 && <div className={cn(SEPARATOR_CLASS, "my-1")} />}

              <div className="group/org flex h-11 w-full items-center gap-2 rounded-xl px-2 transition-colors hover:bg-brandAlt-100/60">
                <button
                  type="button"
                  onClick={() => hasOffices && toggleOrg(org.id)}
                  disabled={isOfficeless}
                  aria-expanded={hasOffices ? isExpanded : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2.5 text-left",
                    hasOffices ? "cursor-pointer" : "cursor-default",
                    isOfficeless && "cursor-not-allowed opacity-50",
                  )}
                >
                  <OrgAvatar
                    name={org.name}
                    logoUrl={org.logoUrl}
                    className={cn(
                      "size-8 shrink-0 rounded-lg border border-white shadow-sm",
                      isCurrentOrg && "ring-2 ring-brand-800/25",
                    )}
                  />
                  <span
                    className="truncate text-[13px] font-medium text-foreground"
                    title={org.name}
                  >
                    {org.name}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {isOfficeless ? (
                    <span className="text-xs text-gray-550">
                      No offices available
                    </span>
                  ) : isCurrentOrg ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium leading-4 text-brand-800 ring-1 ring-inset ring-brand-800/15">
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOrgSelect(org.slug);
                      }}
                      className={cn(
                        ICON_BUTTON_CLASS,
                        "opacity-0 transition-opacity focus-visible:opacity-100 group-hover/org:opacity-100",
                      )}
                      aria-label={`Switch to ${org.name}`}
                      title={`Switch to ${org.name}`}
                    >
                      <ArrowLeftRight aria-hidden className="size-4" />
                    </button>
                  )}
                  {hasOffices && (
                    <button
                      type="button"
                      onClick={() => toggleOrg(org.id)}
                      aria-label={
                        isExpanded
                          ? `Collapse ${org.name}`
                          : `Expand ${org.name}`
                      }
                      className={ICON_BUTTON_CLASS}
                    >
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "size-4 transition-transform duration-200 ease-out motion-reduce:transition-none",
                          isExpanded && "rotate-180",
                        )}
                      />
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && hasOffices && (
                <div className="flex flex-col gap-0.5">
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
                        aria-current={isCurrent ? "page" : undefined}
                        className={cn(
                          "group/office flex h-9 w-full items-center gap-2.5 rounded-xl px-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700",
                          isCurrent
                            ? "bg-brandAlt-100 text-brand-900"
                            : "text-foreground hover:bg-brandAlt-100/60",
                        )}
                      >
                        {/* Gutter the width of the org avatar, so office names
                            line up with org names; holds the active tick. */}
                        <span className="flex size-8 shrink-0 items-center justify-center">
                          {isCurrent && (
                            <Check
                              aria-hidden
                              className="size-4 text-brand-800"
                            />
                          )}
                        </span>

                        <span
                          className={cn(
                            "flex-1 truncate text-[13px]",
                            isCurrent && "font-medium",
                          )}
                          title={office.name}
                        >
                          {office.name}
                        </span>

                        {!isCurrent && (
                          <span className="flex items-center gap-1 text-xs font-medium text-brand-800 opacity-0 transition-opacity group-hover/office:opacity-100 group-focus-visible/office:opacity-100">
                            Switch
                            <ArrowRight aria-hidden className="size-3.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Membership toggle — deliberately outside the scrolling list container
          so it stays visible while the org list scrolls. */}
      {showMembershipFilter && (
        <>
          <div className={cn(SEPARATOR_CLASS, "my-1.5")} />
          <div className="flex items-center gap-2 px-2 py-1">
            {/* `htmlFor` on a <button> is valid — buttons are labelable — and
                avoids nesting a button inside a clickable wrapper. */}
            <label
              htmlFor={membershipFilterId}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-xs font-medium text-foreground"
            >
              Only my organizations
              {isMembershipFilterActive && hiddenCount > 0 && (
                <span className="shrink-0 rounded-full bg-slate-900/[0.04] px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-550 ring-1 ring-inset ring-slate-900/[0.06]">
                  {hiddenCount} hidden
                </span>
              )}
            </label>
            <Switch
              id={membershipFilterId}
              checked={onlyMyOrgs}
              onCheckedChange={setOnlyMyOrgs}
              aria-label="Only my organizations"
              // The shared Switch defaults to `bg-primary` (near-black here);
              // match the popover's green accent instead.
              className="data-[state=checked]:bg-brand-800"
            />
          </div>
        </>
      )}
    </div>
  );
}
