"use client";

import type { ReactNode } from "react";

import { cn } from "@wildfires-org/turboplan-utils";

interface DocumentsListProps {
  children: ReactNode;
  className?: string;
  variant: "section" | "default" | "compact";
}

export function DocumentsList({
  children,
  className,
  variant,
}: DocumentsListProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1",
        variant === "section" && "gap-4 md:grid-cols-2",
        variant === "default" && "gap-3 md:grid-cols-2",
        variant === "compact" && "gap-3 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
