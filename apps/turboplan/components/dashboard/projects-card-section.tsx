"use client";

import { useMemo, useState } from "react";

import {
  Archive,
  Calendar,
  CheckCircle2,
  Edit,
  FolderOpen,
  ListChecks,
  MoreVertical,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { OwnershipStatus } from "@wildfires-org/turboplan-db/types";
import { EntityType } from "@wildfires-org/turboplan-rbac";
import {
  calculateProgress,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";
import type { ProjectWithCoverImage } from "@wildfires-org/turboplan-workspace/types";

import { AddProjectDialog } from "@/components/dashboard/add-project-dialog";
import { CardListEmptyState } from "@/components/dashboard/card-list-empty-state";
import { CreateProjectButton } from "@/components/dashboard/create-project-button";
import { DeleteProjectDialog } from "@/components/dashboard/delete-project-dialog";
import { EditProjectDialog } from "@/components/dashboard/edit-project-dialog";
import { EntityCard } from "@/components/dashboard/entity-card";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { ListPagination } from "@/components/dashboard/list-pagination";
import { ManageMembersDialog } from "@/components/dashboard/manage-members-dialog";
import { MetadataChip } from "@/components/dashboard/metadata-chip";
import { OfficeTabNav } from "@/components/dashboard/office-tab-nav";
import { PrivacyBadge } from "@/components/dashboard/privacy-badge";
import { ProgressBar } from "@/components/dashboard/progress-bar";
import { ProjectCardSkeleton } from "@/components/dashboard/project-card-skeleton";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { toast } from "@/components/toast";
import { useFilteredPaginatedList } from "@/hooks/use-filtered-paginated-list";
import { useProjects } from "@/hooks/use-projects";
import { GLASS_ICON_BUTTON_CLASS, STICKY_TOOLBAR_CLASS } from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────

const apiClient = new ApiClient();

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "All", value: "all" },
  { label: "Archived", value: "archived" },
];

const SORT_OPTIONS = [
  { label: "Name A-Z", value: "name-asc" },
  { label: "Name Z-A", value: "name-desc" },
  { label: "Newest", value: "created-desc" },
  { label: "Oldest", value: "created-asc" },
  { label: "Due Date", value: "due-desc" },
  { label: "Start Date", value: "start-desc" },
];

const PAGE_SIZE_OPTIONS = [9, 18, 27];

// ── Types ─────────────────────────────────────────────────────────────

interface ProjectsCardSectionProps {
  user?: User;
  organizationSlug: string;
  officeSlug: string;
  autoOpenCreateProject?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────

const formatDueDate = (date: Date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatCreatorName = (project: ProjectWithCoverImage) => {
  if (project.creatorFirstName || project.creatorLastName) {
    return [project.creatorFirstName, project.creatorLastName]
      .filter(Boolean)
      .join(" ");
  }
  return project.creatorEmail ?? "Unknown";
};

const getProjectSortComparator =
  (sortBy: string) => (a: ProjectWithCoverImage, b: ProjectWithCoverImage) => {
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
      case "due-desc": {
        const aDate = a.endDate ? new Date(a.endDate).getTime() : 0;
        const bDate = b.endDate ? new Date(b.endDate).getTime() : 0;
        return bDate - aDate;
      }
      case "start-desc": {
        const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
        const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
        return bDate - aDate;
      }
      default:
        return 0;
    }
  };

// ── Component ─────────────────────────────────────────────────────────

export function ProjectsCardSection({
  user,
  organizationSlug,
  officeSlug,
  autoOpenCreateProject = false,
}: ProjectsCardSectionProps) {
  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(
    autoOpenCreateProject,
  );
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [editingProject, setEditingProject] =
    useState<ProjectWithCoverImage | null>(null);
  const [deletingProject, setDeletingProject] =
    useState<ProjectWithCoverImage | null>(null);
  const [managingMembersProject, setManagingMembersProject] =
    useState<ProjectWithCoverImage | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  const handleCreateDialogClose = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open && autoOpenCreateProject) {
      router.replace(pathname, { scroll: false });
    }
  };

  // Data fetching
  const { projects, isLoading, refreshProjects } = useProjects({
    organizationSlug,
    officeSlug,
    filters: { isTemplate: false },
  });

  // Filter out citizen submission projects that are still under review or rejected —
  // they are shown in a dedicated tab. Accepted projects are now government-owned
  // and should appear as regular projects in the main list.
  const nonSubmissionProjects = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.ownershipStatus !== OwnershipStatus.SUBMITTED &&
          p.ownershipStatus !== OwnershipStatus.REJECTED,
      ),
    [projects],
  );

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
    items: nonSubmissionProjects,
    getSortComparator: getProjectSortComparator,
  });

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleArchiveProject = async (project: ProjectWithCoverImage) => {
    try {
      const { error } = await apiClient.put(`/api/projects/${project.id}`, {
        status: "archived",
      });
      if (error) throw new Error(error);
      toast({ type: "success", description: "Project archived successfully" });
      refreshProjects();
    } catch (error) {
      console.error("Error archiving project:", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to archive project",
      });
    }
  };

  const handleActivateProject = async (project: ProjectWithCoverImage) => {
    try {
      const { error } = await apiClient.put(`/api/projects/${project.id}`, {
        status: "active",
      });
      if (error) throw new Error(error);
      toast({
        type: "success",
        description: "Project activated successfully",
      });
      refreshProjects();
    } catch (error) {
      console.error("Error activating project:", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to activate project",
      });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* Sticky tabs + search + filters */}
      <div className={STICKY_TOOLBAR_CLASS}>
        <OfficeTabNav
          orgSlug={organizationSlug}
          officeSlug={officeSlug}
          searchValue={searchTerm}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search projects..."
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

      {/* Project cards grid */}
      {isLoading ? (
        <ProjectCardSkeleton />
      ) : filteredItems.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedItems.map((project) => {
            const progress = calculateProgress(
              project.startDate,
              project.endDate,
            );

            return (
              <div key={project.id} className="relative">
                <EntityCard
                  className="h-[340px]"
                  href={AppUrls.project(
                    organizationSlug,
                    officeSlug,
                    project.slug,
                  )}
                  coverImageUrl={project.coverImageUrl}
                  badges={
                    <div className="flex items-center gap-1.5">
                      <StatusBadge
                        status={
                          project.status as
                            | "active"
                            | "inactive"
                            | "completed"
                            | "archived"
                        }
                      />
                      <PrivacyBadge isPublic={project.isPublic} />
                    </div>
                  }
                  title={project.name}
                  description={project.description}
                  progress={
                    progress ? (
                      <ProgressBar percentage={progress.progressPercent} />
                    ) : undefined
                  }
                  metadata={
                    <>
                      {progress && (
                        <MetadataChip icon={Calendar}>
                          {formatDueDate(progress.dueDate)}
                        </MetadataChip>
                      )}
                      {project.taskCount > 0 && (
                        <MetadataChip icon={ListChecks}>
                          <span className="font-semibold">
                            {project.completedTaskCount}/{project.taskCount}
                          </span>{" "}
                          tasks
                        </MetadataChip>
                      )}
                    </>
                  }
                  footer={
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-550">
                      {project.creatorAvatarUrl ? (
                        <Image
                          src={project.creatorAvatarUrl}
                          alt=""
                          width={14}
                          height={14}
                          className="rounded-full"
                        />
                      ) : (
                        <span className="flex size-3.5 items-center justify-center rounded-full bg-brandAlt-200 text-[8px] font-medium text-brand-900">
                          {(
                            project.creatorFirstName?.[0] ||
                            project.creatorEmail?.[0] ||
                            "?"
                          ).toUpperCase()}
                        </span>
                      )}
                      {formatCreatorName(project)}
                    </span>
                  }
                />

                {/* Dropdown overlay */}
                <div className="absolute right-4 top-4 z-10">
                  <DropdownMenu
                    modal={true}
                    open={openDropdown === project.id}
                    onOpenChange={(open) =>
                      setOpenDropdown(open ? project.id : null)
                    }
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for ${project.name}`}
                        className={cn(
                          GLASS_ICON_BUTTON_CLASS,
                          "bg-white/70 data-[state=open]:bg-white",
                        )}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <MoreVertical className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="bottom"
                      align="end"
                      className="w-[200px] p-1.5"
                    >
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setEditingProject(project);
                          setOpenDropdown(null);
                        }}
                        className="cursor-pointer"
                      >
                        <Edit className="mr-2 size-4" />
                        Edit Project
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setManagingMembersProject(project);
                          setOpenDropdown(null);
                        }}
                        className="cursor-pointer"
                      >
                        <Users className="mr-2 size-4" />
                        Manage Members
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {project.status === "active" && (
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            setOpenDropdown(null);
                            handleArchiveProject(project);
                          }}
                          className="cursor-pointer text-error-700 focus:bg-error-50 focus:text-error-700 data-[highlighted]:bg-error-50 data-[highlighted]:text-error-700"
                        >
                          <Archive className="mr-2 size-4" />
                          Archive Project
                        </DropdownMenuItem>
                      )}
                      {project.status === "archived" && (
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            setOpenDropdown(null);
                            handleActivateProject(project);
                          }}
                          className="cursor-pointer"
                        >
                          <CheckCircle2 className="mr-2 size-4" />
                          Activate Project
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setDeletingProject(project);
                          setOpenDropdown(null);
                        }}
                        className="cursor-pointer text-error-700 focus:bg-error-50 focus:text-error-700 data-[highlighted]:bg-error-50 data-[highlighted]:text-error-700"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <CardListEmptyState
          icon={FolderOpen}
          entityLabel="projects"
          hasSearchTerm={!!debouncedSearchTerm}
          createAction={
            <CreateProjectButton
              organizationSlug={organizationSlug}
              officeSlug={officeSlug}
              onSuccess={refreshProjects}
              variant="brand"
            >
              <Plus aria-hidden />
              Create First Project
            </CreateProjectButton>
          }
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

      {/* Edit project dialog */}
      {editingProject && (
        <EditProjectDialog
          project={editingProject}
          organizationSlug={organizationSlug}
          officeSlug={officeSlug}
          open={!!editingProject}
          onOpenChange={(open) => {
            if (!open) {
              setEditingProject(null);
              setOpenDropdown(null);
            }
          }}
          onSuccess={() => {
            refreshProjects();
            setEditingProject(null);
            setOpenDropdown(null);
          }}
        />
      )}

      {/* Delete project dialog */}
      {deletingProject && (
        <DeleteProjectDialog
          project={deletingProject}
          open={!!deletingProject}
          onOpenChange={(open) => {
            if (!open) {
              setDeletingProject(null);
              setOpenDropdown(null);
            }
          }}
          onSuccess={() => {
            refreshProjects();
            setDeletingProject(null);
            setOpenDropdown(null);
          }}
        />
      )}

      {/* Manage members dialog */}
      {managingMembersProject && (
        <ManageMembersDialog
          entityType={EntityType.PROJECT}
          entityId={managingMembersProject.id}
          entityName={managingMembersProject.name}
          user={user}
          open={!!managingMembersProject}
          onOpenChange={(open) => {
            if (!open) {
              setManagingMembersProject(null);
              setOpenDropdown(null);
            }
          }}
        />
      )}

      {/* Auto-open create project dialog (triggered by ?create-project=true) */}
      <AddProjectDialog
        organizationSlug={organizationSlug}
        officeSlug={officeSlug}
        open={createDialogOpen}
        onOpenChange={handleCreateDialogClose}
        onSuccess={() => {
          refreshProjects();
          setCreateDialogOpen(false);
        }}
      />
    </div>
  );
}
