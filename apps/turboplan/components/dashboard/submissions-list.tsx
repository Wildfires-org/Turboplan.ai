"use client";

import { FolderInput } from "lucide-react";

import { CardListEmptyState } from "@/components/dashboard/card-list-empty-state";
import {
  CitizenSubmissionCard,
  type CitizenSubmissionCardProject,
} from "@/components/dashboard/citizen-submission-card";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { ListPagination } from "@/components/dashboard/list-pagination";
import { OfficeTabNav } from "@/components/dashboard/office-tab-nav";
import { ProjectCardSkeleton } from "@/components/dashboard/project-card-skeleton";
import { useFilteredPaginatedList } from "@/hooks/use-filtered-paginated-list";
import { STICKY_TOOLBAR_CLASS } from "@/lib/glass";

// ── Constants ─────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "New", value: "submitted" },
  { label: "Approved", value: "accepted" },
  { label: "Rejected", value: "rejected" },
];

const SORT_OPTIONS = [
  { label: "Newest", value: "created-desc" },
  { label: "Oldest", value: "created-asc" },
  { label: "Name A-Z", value: "name-asc" },
  { label: "Name Z-A", value: "name-desc" },
];

const PAGE_SIZE_OPTIONS = [9, 18, 27];

// ── Types ─────────────────────────────────────────────────────────────

interface SubmissionsListProps {
  organizationSlug: string;
  officeSlug: string;
  submissions: CitizenSubmissionCardProject[];
  isLoading: boolean;
  getHref: (project: CitizenSubmissionCardProject) => string;
  emptyStateLabel?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

const getSortComparator =
  (sortBy: string) =>
  (a: CitizenSubmissionCardProject, b: CitizenSubmissionCardProject) => {
    switch (sortBy) {
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "created-desc":
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case "created-asc":
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      default:
        return 0;
    }
  };

// ── Component ─────────────────────────────────────────────────────────

export const SubmissionsList = ({
  organizationSlug,
  officeSlug,
  submissions,
  isLoading,
  getHref,
  emptyStateLabel = "submissions",
}: SubmissionsListProps) => {
  const {
    statusFilter,
    handleStatusFilterChange,
    sortBy,
    setSortBy,
    searchTerm,
    debouncedSearchTerm,
    handleSearchChange,
    pageSize,
    handlePageSizeChange,
    setCurrentPage,
    filteredItems,
    paginatedItems,
    totalPages,
    safePage,
  } = useFilteredPaginatedList({
    items: submissions,
    getSortComparator,
    statusField: "ownershipStatus",
    defaultStatusFilter: "all",
    defaultSort: "created-desc",
  });

  return (
    <div className="space-y-2">
      {/* Sticky tabs + search + filters */}
      <div className={STICKY_TOOLBAR_CLASS}>
        <OfficeTabNav
          orgSlug={organizationSlug}
          officeSlug={officeSlug}
          searchValue={searchTerm}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search submissions..."
        />

        <div className="mt-6">
          <FilterBar
            filters={[
              {
                key: "status",
                label: "Status",
                options: STATUS_OPTIONS,
                value: statusFilter,
                onChange: handleStatusFilterChange,
              },
            ]}
            sort={{
              options: SORT_OPTIONS,
              value: sortBy,
              onChange: setSortBy,
            }}
            pageSize={{
              options: PAGE_SIZE_OPTIONS,
              value: pageSize,
              onChange: handlePageSizeChange,
            }}
          />
        </div>
      </div>

      {/* Submission cards grid */}
      {isLoading ? (
        <ProjectCardSkeleton cardClassName="h-[344px]" />
      ) : filteredItems.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedItems.map((project) => (
            <CitizenSubmissionCard
              key={project.id}
              project={project}
              href={getHref(project)}
            />
          ))}
        </div>
      ) : (
        <CardListEmptyState
          icon={FolderInput}
          entityLabel={emptyStateLabel}
          hasSearchTerm={!!debouncedSearchTerm}
        />
      )}

      {/* Pagination */}
      {!isLoading && filteredItems.length > 0 && (
        <ListPagination
          currentPage={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredItems.length}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};
