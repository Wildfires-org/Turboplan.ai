"use client";

import { useState } from "react";

import type { PublicOrganization } from "@wildfires-org/turboplan-public/types";
import { cn } from "@wildfires-org/turboplan-utils";

import { routing } from "@/utils/routing";
import { CATALOG_GRID_CLASS } from "./catalog-layout";
import { OrganizationCard } from "./organization-card";
import PaginationControls from "./pagination-controls";

const PAGE_SIZE = 9;

interface OrganizationsListProps {
  organizations: PublicOrganization[];
  className?: string;
}

export function OrganizationsList({
  organizations,
  className,
}: OrganizationsListProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(organizations.length / PAGE_SIZE);
  const paginatedOrganizations = organizations.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <div className={cn("w-full", className)}>
      {/* min-h keeps pagination still when the last page is short */}
      <ul
        role="list"
        aria-label="Organizations"
        className={cn(
          CATALOG_GRID_CLASS,
          "content-start",
          totalPages > 1 && "sm:min-h-[504px] lg:min-h-[312px]",
        )}
      >
        {paginatedOrganizations.map((organization) => (
          <OrganizationCard
            key={organization.id}
            organization={organization}
            href={routing.catalogOrganization({
              organizationSlug: organization.slug,
            })}
          />
        ))}
      </ul>

      {totalPages > 1 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          className="mt-8"
        />
      )}
    </div>
  );
}
