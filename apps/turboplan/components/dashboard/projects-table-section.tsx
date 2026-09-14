"use client";

import { useMemo, useState } from "react";

import { Plus, Search } from "lucide-react";
import type { User } from "next-auth";

import { EntityType } from "@wildfires-org/turboplan-rbac";
import { Input } from "@wildfires-org/turboplan-utils";
import type { Project } from "@wildfires-org/turboplan-workspace/types";

import { CreateProjectButton } from "@/components/dashboard/create-project-button";
import { DeleteProjectDialog } from "@/components/dashboard/delete-project-dialog";
import { EditProjectDialog } from "@/components/dashboard/edit-project-dialog";
import { ManageMembersDialog } from "@/components/dashboard/manage-members-dialog";
import { ProjectsDataTable } from "@/components/dashboard/projects-data-table";
import { getProjectColumns } from "@/components/dashboard/projects-table-columns";
import { useProjects } from "@/hooks/use-projects";

interface ProjectsTableSectionProps {
  user?: User;
  organizationSlug: string;
  officeSlug: string;
}

export function ProjectsTableSection({
  user,
  organizationSlug,
  officeSlug,
}: ProjectsTableSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [managingMembersProject, setManagingMembersProject] =
    useState<Project | null>(null);

  const { projects, isLoading, refreshProjects } = useProjects({
    organizationSlug,
    officeSlug,
    filters: { isTemplate: false },
  });

  const columns = useMemo(
    () =>
      getProjectColumns({
        organizationSlug,
        officeSlug,
        onEditProject: setEditingProject,
        onManageMembers: setManagingMembersProject,
        onDeleteProject: setDeletingProject,
      }),
    [organizationSlug, officeSlug],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track your projects in this office.
          </p>
        </div>
        <CreateProjectButton
          organizationSlug={organizationSlug}
          officeSlug={officeSlug}
          onSuccess={refreshProjects}
        >
          <Plus className="mr-2 size-4" />
          New Project
        </CreateProjectButton>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Projects Table */}
      {isLoading ? (
        <div className="border border-border rounded-lg">
          <div className="p-4 space-y-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={`skeleton-${i}`}
                className="animate-pulse flex items-center space-x-4"
              >
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
                <div className="h-4 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-16" />
                <div className="h-4 bg-muted rounded w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="text-center py-12 text-muted-foreground">
            <div className="size-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Plus className="size-6 opacity-50" />
            </div>
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-sm mb-4">
              Create your first project to get started with organizing your
              work.
            </p>
            <CreateProjectButton
              organizationSlug={organizationSlug}
              officeSlug={officeSlug}
              onSuccess={refreshProjects}
            >
              <Plus className="mr-2 size-4" />
              Create First Project
            </CreateProjectButton>
          </div>
        </div>
      ) : (
        <ProjectsDataTable
          columns={columns}
          data={projects}
          filterValue={searchTerm}
        />
      )}

      {editingProject && (
        <EditProjectDialog
          project={editingProject}
          organizationSlug={organizationSlug}
          officeSlug={officeSlug}
          open={!!editingProject}
          onOpenChange={(open) => {
            if (!open) {
              setEditingProject(null);
            }
          }}
          onSuccess={() => {
            refreshProjects();
            setEditingProject(null);
          }}
        />
      )}

      {deletingProject && (
        <DeleteProjectDialog
          project={deletingProject}
          open={!!deletingProject}
          onOpenChange={(open) => {
            if (!open) {
              setDeletingProject(null);
            }
          }}
          onSuccess={() => {
            refreshProjects();
            setDeletingProject(null);
          }}
        />
      )}

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
            }
          }}
        />
      )}
    </div>
  );
}
