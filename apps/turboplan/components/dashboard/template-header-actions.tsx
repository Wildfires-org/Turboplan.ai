"use client";

import { useState } from "react";

import { CopyPlus, Edit, MoreVertical } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";
import type { Project } from "@wildfires-org/turboplan-workspace/types";

import { CreateProjectFromTemplateDialog } from "./create-project-from-template-dialog";
import { EditProjectDialog } from "./edit-project-dialog";

interface TemplateHeaderActionsProps {
  project: Project;
  organizationSlug: string;
  officeSlug: string;
  onEditSuccess?: () => void;
}

export function TemplateHeaderActions({
  project,
  organizationSlug,
  officeSlug,
  onEditSuccess,
}: TemplateHeaderActionsProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);

  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="size-4" />
            <span className="sr-only">Template actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end">
          <DropdownMenuItem onSelect={() => setShowEditDialog(true)}>
            <Edit className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShowCreateProjectDialog(true)}>
            <CopyPlus className="mr-2 size-4" />
            Use Template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditProjectDialog
        project={project}
        organizationSlug={organizationSlug}
        officeSlug={officeSlug}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={() => onEditSuccess?.()}
      />
      <CreateProjectFromTemplateDialog
        open={showCreateProjectDialog}
        onOpenChange={setShowCreateProjectDialog}
        template={project}
        organizationSlug={organizationSlug}
        officeSlug={officeSlug}
      />
    </div>
  );
}
