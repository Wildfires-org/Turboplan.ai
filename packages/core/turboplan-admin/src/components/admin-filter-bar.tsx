"use client";

import type { ReactNode } from "react";

import { RotateCw, Search, X } from "lucide-react";

import { Button, cn, Skeleton } from "@wildfires-org/turboplan-utils";

interface AdminFilterBarProps {
  onApply: () => void;
  onClear: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  children: ReactNode;
  extraActions?: ReactNode;
}

export const AdminFilterBar = ({
  onApply,
  onClear,
  onRefresh,
  isLoading,
  children,
  extraActions,
}: AdminFilterBarProps) => {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      {children}

      <div className="flex items-end gap-2">
        <Button size="sm" className="h-9" onClick={onApply}>
          <Search className="size-4 mr-1" />
          Apply
        </Button>
        <Button size="sm" className="h-9" variant="outline" onClick={onClear}>
          <X className="size-4 mr-1" />
          Clear
        </Button>
        <Button
          size="icon"
          className="h-9 w-9"
          variant="outline"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RotateCw className={cn("size-4", isLoading && "animate-spin")} />
        </Button>
        {extraActions}
      </div>
    </div>
  );
};

export const AdminErrorState = ({ error }: { error: string }) => {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      {error}
    </div>
  );
};

export const AdminLoadingSkeleton = ({ rows = 5 }: { rows?: number }) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={`skeleton-${i}`} className="h-12 w-full" />
      ))}
    </div>
  );
};
