"use client";

import type { ButtonProps } from "@wildfires-org/turboplan-utils";

import { AddOfficeDialog } from "./add-office-dialog";
import { CreateEntityButton } from "./create-entity-button";

interface CreateOfficeButtonProps {
  children: React.ReactNode;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  onSuccess: () => void;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}

export function CreateOfficeButton({
  children,
  organizationId,
  organizationSlug,
  organizationName,
  onSuccess,
  className,
  variant = "default",
  size,
}: CreateOfficeButtonProps) {
  return (
    <CreateEntityButton
      onSuccess={onSuccess}
      className={className}
      variant={variant}
      size={size}
      renderDialog={({ open, onOpenChange, onSuccess: handleSuccess }) => (
        <AddOfficeDialog
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          organizationName={organizationName}
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
