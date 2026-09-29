"use client";

import { useState } from "react";

import { Button, type ButtonProps } from "@wildfires-org/turboplan-utils";

interface CreateEntityButtonProps {
  children: React.ReactNode;
  onSuccess: () => void;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  renderDialog: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
  }) => React.ReactNode;
}

export function CreateEntityButton({
  children,
  onSuccess,
  className,
  variant = "default",
  size,
  renderDialog,
}: CreateEntityButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSuccess = () => {
    onSuccess();
    setIsDialogOpen(false);
  };

  return (
    <>
      <Button
        onClick={() => setIsDialogOpen(true)}
        className={className}
        variant={variant}
        size={size}
      >
        {children}
      </Button>
      {renderDialog({
        open: isDialogOpen,
        onOpenChange: setIsDialogOpen,
        onSuccess: handleSuccess,
      })}
    </>
  );
}
