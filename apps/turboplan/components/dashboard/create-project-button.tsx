"use client";

import { AddProjectDialog } from "./add-project-dialog";
import { CreateEntityButton } from "./create-entity-button";

interface CreateProjectButtonProps {
  children: React.ReactNode;
  organizationSlug: string;
  officeSlug: string;
  onSuccess: () => void;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export function CreateProjectButton({
  children,
  organizationSlug,
  officeSlug,
  onSuccess,
  className,
  variant = "default",
  size,
}: CreateProjectButtonProps) {
  return (
    <CreateEntityButton
      onSuccess={onSuccess}
      className={className}
      variant={variant}
      size={size}
      renderDialog={({ open, onOpenChange, onSuccess: handleSuccess }) => (
        <AddProjectDialog
          organizationSlug={organizationSlug}
          officeSlug={officeSlug}
          open={open}
          onOpenChange={onOpenChange}
          onSuccess={handleSuccess}
        />
      )}
    >
      {children}
    </CreateEntityButton>
  );
}
