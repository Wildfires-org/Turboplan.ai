"use client";

import { useState } from "react";

import {
  Archive,
  Building2,
  Calendar,
  CheckCircle2,
  CirclePlay,
  Edit,
  FolderOpen,
  MoreVertical,
  Plus,
  Users,
} from "lucide-react";
import type { User } from "next-auth";

import { EntityType } from "@wildfires-org/turboplan-rbac";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";
import type { OfficeWithProjectCounts } from "@wildfires-org/turboplan-workspace/types";

import { CardListEmptyState } from "@/components/dashboard/card-list-empty-state";
import { CreateOfficeButton } from "@/components/dashboard/create-office-button";
import { EditOfficeDialog } from "@/components/dashboard/edit-office-dialog";
import { EntityCard } from "@/components/dashboard/entity-card";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { ListPagination } from "@/components/dashboard/list-pagination";
import { ManageMembersDialog } from "@/components/dashboard/manage-members-dialog";
import { MetadataChip } from "@/components/dashboard/metadata-chip";
import { OfficeSkeleton } from "@/components/dashboard/office-skeleton";
import { OrgTabNav } from "@/components/dashboard/org-tab-nav";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { toast } from "@/components/toast";
import { useFilteredPaginatedList } from "@/hooks/use-filtered-paginated-list";
import { useOfficeStatus } from "@/hooks/use-office-status";
import { useOffices } from "@/hooks/use-offices";
import { STICKY_TOOLBAR_CLASS } from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";

// ── Filter options ──────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "All", value: "all" },
  { label: "Archived", value: "archived" },
];

const SORT_OPTIONS = [
  { label: "Name A-Z", value: "name-asc" },
  { label: "Name Z-A", value: "name-desc" },
  { label: "Most Projects", value: "projects-desc" },
  { label: "Most Active", value: "active-desc" },
  { label: "Newest", value: "created-desc" },
  { label: "Oldest", value: "created-asc" },
];

const PAGE_SIZE_OPTIONS = [9, 18, 27];

// ── Types ───────────────────────────────────────────────────────────────

interface OfficesSectionProps {
  user?: User;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  isMember?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────

const formatCreatedAt = (date: Date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const getOfficeSortComparator =
  (sortBy: string) =>
  (a: OfficeWithProjectCounts, b: OfficeWithProjectCounts) => {
    switch (sortBy) {
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "projects-desc":
        return b.projectCount - a.projectCount;
      case "active-desc":
        return b.activeProjectCount - a.activeProjectCount;
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

// ── Component ───────────────────────────────────────────────────────────

export function OfficesSection({
  user,
  organizationId,
  organizationSlug,
  organizationName,
  isMember = true,
}: OfficesSectionProps) {
  // Dialog state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [editingOffice, setEditingOffice] =
    useState<OfficeWithProjectCounts | null>(null);
  const [managingMembersOffice, setManagingMembersOffice] =
    useState<OfficeWithProjectCounts | null>(null);

  // Data fetching
  const { offices, isLoading, refreshOffices } = useOffices({
    organizationSlug,
  });

  const { updateOfficeStatus: archiveOffice } = useOfficeStatus("archived");
  const { updateOfficeStatus: activateOffice } = useOfficeStatus("active");

  // Filtering, sorting, pagination
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
    items: offices,
    getSortComparator: getOfficeSortComparator,
  });

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleArchiveOffice = async (office: OfficeWithProjectCounts) => {
    try {
      await archiveOffice(office.id);
      toast({ type: "success", description: "Office archived successfully" });
      refreshOffices();
    } catch (error) {
      console.error("Error archiving office:", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to archive office",
      });
    }
  };

  const handleActivateOffice = async (office: OfficeWithProjectCounts) => {
    try {
      await activateOffice(office.id);
      toast({ type: "success", description: "Office activated successfully" });
      refreshOffices();
    } catch (error) {
      console.error("Error activating office:", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to activate office",
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* Sticky tabs + search + filters */}
      <div className={STICKY_TOOLBAR_CLASS}>
        <OrgTabNav
          orgSlug={organizationSlug}
          isMember={isMember}
          searchValue={searchTerm}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search offices..."
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

      {/* Office cards grid */}
      {isLoading ? (
        <OfficeSkeleton />
      ) : filteredItems.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedItems.map((office) => (
            <div key={office.id} className="relative">
              <EntityCard
                href={AppUrls.office(organizationSlug, office.slug)}
                badges={
                  <StatusBadge
                    status={
                      office.status === "archived" ? "archived" : "active"
                    }
                  />
                }
                title={office.name}
                description={office.description}
                metadata={
                  <>
                    <MetadataChip icon={FolderOpen}>
                      <span className="font-semibold">
                        {office.projectCount}
                      </span>{" "}
                      Projects
                    </MetadataChip>
                    <MetadataChip icon={CirclePlay}>
                      <span className="font-semibold">
                        {office.activeProjectCount}
                      </span>{" "}
                      Active
                    </MetadataChip>
                    <MetadataChip icon={Calendar}>
                      {formatCreatedAt(office.createdAt)}
                    </MetadataChip>
                  </>
                }
              />

              {/* Dropdown overlay */}
              {isMember && (
                <div className="absolute right-3 top-3 z-10">
                  <DropdownMenu
                    modal={true}
                    open={openDropdown === office.id}
                    onOpenChange={(open) =>
                      setOpenDropdown(open ? office.id : null)
                    }
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label={`Actions for ${office.name}`}
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="bottom" align="end">
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setEditingOffice(office);
                          setOpenDropdown(null);
                        }}
                        className="cursor-pointer"
                      >
                        <Edit className="mr-2 size-4" />
                        Edit Office
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setManagingMembersOffice(office);
                          setOpenDropdown(null);
                        }}
                        className="cursor-pointer"
                      >
                        <Users className="mr-2 size-4" />
                        Manage Office Members
                      </DropdownMenuItem>
                      {office.status === "active" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              setOpenDropdown(null);
                              handleArchiveOffice(office);
                            }}
                            className="cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Archive className="mr-2 size-4" />
                            Archive Office
                          </DropdownMenuItem>
                        </>
                      )}
                      {office.status === "archived" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              setOpenDropdown(null);
                              handleActivateOffice(office);
                            }}
                            className="cursor-pointer"
                          >
                            <CheckCircle2 className="mr-2 size-4" />
                            Activate Office
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

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

      {/* Empty state */}
      {!isLoading && filteredItems.length === 0 && (
        <CardListEmptyState
          icon={Building2}
          entityLabel="offices"
          hasSearchTerm={!!debouncedSearchTerm}
          createAction={
            isMember ? (
              <CreateOfficeButton
                organizationId={organizationId}
                organizationSlug={organizationSlug}
                organizationName={organizationName}
                onSuccess={refreshOffices}
              >
                <Plus className="mr-2 size-4" />
                Create First Office
              </CreateOfficeButton>
            ) : undefined
          }
        />
      )}

      {/* Edit office dialog */}
      {editingOffice && (
        <EditOfficeDialog
          office={editingOffice}
          organizationSlug={organizationSlug}
          open={!!editingOffice}
          onOpenChange={(open) => {
            if (!open) {
              setEditingOffice(null);
              setOpenDropdown(null);
            }
          }}
          onSuccess={() => {
            refreshOffices();
            setEditingOffice(null);
            setOpenDropdown(null);
          }}
        />
      )}

      {/* Manage members dialog */}
      {managingMembersOffice && (
        <ManageMembersDialog
          entityType={EntityType.OFFICE}
          entityId={managingMembersOffice.id}
          entityName={managingMembersOffice.name}
          user={user}
          open={!!managingMembersOffice}
          onOpenChange={(open) => {
            if (!open) {
              setManagingMembersOffice(null);
              setOpenDropdown(null);
            }
          }}
        />
      )}
    </div>
  );
}
