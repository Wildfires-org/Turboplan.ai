"use client";

import { useState } from "react";

import type { PublicOrganization } from "@wildfires-org/turboplan-public/types";
import { cn } from "@wildfires-org/turboplan-utils";

import { routing } from "@/utils/routing";
import { OrganizationCard } from "./organization-card";
import { OrganizationsSectionHeader } from "./organizations-section-header";
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
    <section
      className={cn(
        "bg-white/95 p-6 md:p-12 drop-shadow mt-6 w-full max-w-[1080px] mx-auto rounded-t-3xl",
        className,
      )}
    >
      <OrganizationsSectionHeader />

      <div className="min-h-[445px] md:min-h-[267px] mt-10">
        <ul
          role="list"
          className="rounded-3xl bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 overflow-hidden"
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
      </div>

      <div className="flex items-center justify-center pt-8 h-[72px]">
        {totalPages > 1 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </section>
  );
}
