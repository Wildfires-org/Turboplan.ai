"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Edit,
  MoreVertical,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  calculateProgress,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";
import type { ProjectWithCoverImage } from "@wildfires-org/turboplan-workspace/types";

import { AppUrls } from "@/lib/nav/urls";
import { getStatusColor } from "@/lib/status-colors";

interface ProjectColumnsOptions {
  organizationSlug: string;
  officeSlug: string;
  onEditProject: (project: ProjectWithCoverImage) => void;
  onManageMembers: (project: ProjectWithCoverImage) => void;
  onDeleteProject: (project: ProjectWithCoverImage) => void;
}

function SortableHeader({
  column,
  children,
}: {
  column: {
    toggleSorting: (desc?: boolean) => void;
    getIsSorted: () => false | "asc" | "desc";
  };
  children: React.ReactNode;
}) {
  const sorted = column.getIsSorted();

  return (
    <div
      role="button"
      tabIndex={0}
      className="group inline-flex items-center gap-1.5 cursor-pointer select-none"
      onClick={() => column.toggleSorting()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          column.toggleSorting();
        }
      }}
    >
      {children}
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5 text-foreground" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5 text-foreground" />
      ) : (
        <ArrowUpDown
          className={cn(
            "size-3.5 text-muted-foreground/0 transition-colors",
            "group-hover:text-muted-foreground",
          )}
        />
      )}
    </div>
  );
}

function ProjectActionsDropdown({
  project,
  onEditProject,
  onManageMembers,
  onDeleteProject,
}: {
  project: ProjectWithCoverImage;
  onEditProject: (project: ProjectWithCoverImage) => void;
  onManageMembers: (project: ProjectWithCoverImage) => void;
  onDeleteProject: (project: ProjectWithCoverImage) => void;
}) {
  return (
    <DropdownMenu modal>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end">
        <DropdownMenuItem
          onSelect={() => onEditProject(project)}
          className="cursor-pointer"
        >
          <Edit className="mr-2 size-4" />
          Edit Project
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onManageMembers(project)}
          className="cursor-pointer"
        >
          <Users className="mr-2 size-4" />
          Manage Project Members
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onDeleteProject(project)}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 size-4" />
          Delete Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function getProjectColumns({
  organizationSlug,
  officeSlug,
  onEditProject,
  onManageMembers,
  onDeleteProject,
}: ProjectColumnsOptions): ColumnDef<ProjectWithCoverImage>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortableHeader column={column}>Project Name</SortableHeader>
      ),
      cell: ({ row }) => {
        const project = row.original;
        return (
          <div>
            <Link
              href={AppUrls.project(organizationSlug, officeSlug, project.slug)}
              className="text-sm font-medium text-foreground hover:text-primary"
            >
              {project.name}
            </Link>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1 max-w-xs truncate">
                {project.description}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "progress",
      accessorFn: (row) => {
        const progress = calculateProgress(row.startDate, row.endDate);
        return progress ? progress.progressPercent : -1;
      },
      header: ({ column }) => (
        <SortableHeader column={column}>Progress</SortableHeader>
      ),
      cell: ({ row }) => {
        const progressPercent = row.getValue("progress") as number;

        if (progressPercent < 0) {
          return <span className="text-sm text-muted-foreground">--</span>;
        }

        const percent = Math.round(progressPercent);
        return (
          <div className="flex items-center">
            <div className="flex-1 bg-muted rounded-full h-2 w-16 mr-2">
              <div
                className="bg-primary h-2 rounded-full"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">{percent}%</span>
          </div>
        );
      },
      sortingFn: "basic",
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <SortableHeader column={column}>Status</SortableHeader>
      ),
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset",
              getStatusColor(status),
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      },
    },
    {
      id: "updatedAt",
      accessorFn: (row) => new Date(row.updatedAt).getTime(),
      header: ({ column }) => (
        <SortableHeader column={column}>Updated</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="size-3 mr-1" />
          {new Date(row.original.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </div>
      ),
      sortingFn: "basic",
    },
    {
      id: "owner",
      accessorFn: (row) => {
        const first = row.creatorFirstName;
        const last = row.creatorLastName;
        if (first && last) return `${first} ${last}`;
        if (first) return first;
        if (row.creatorEmail) return row.creatorEmail;
        return "Unknown";
      },
      header: ({ column }) => (
        <SortableHeader column={column}>Owner</SortableHeader>
      ),
      cell: ({ row }) => {
        const name = row.getValue("owner") as string;
        const avatarUrl = row.original.creatorAvatarUrl;
        return (
          <div className="flex items-center">
            <Avatar className="size-8 ring-1 ring-border">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
              <AvatarFallback className="text-xs font-medium">
                {row.original.creatorFirstName?.charAt(0) ||
                  row.original.creatorEmail?.charAt(0).toUpperCase() ||
                  "?"}
              </AvatarFallback>
            </Avatar>
            <span className="ml-3 text-sm font-medium text-foreground">
              {name}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-right">
          <ProjectActionsDropdown
            project={row.original}
            onEditProject={onEditProject}
            onManageMembers={onManageMembers}
            onDeleteProject={onDeleteProject}
          />
        </div>
      ),
    },
  ];
}
