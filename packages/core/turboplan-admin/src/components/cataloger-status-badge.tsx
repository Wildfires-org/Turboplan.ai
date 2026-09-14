"use client";

import { Badge, cn } from "@wildfires-org/turboplan-utils";

import type { CatalogerRunStatus } from "../types";

const getStatusBadgeVariant = (
  status: CatalogerRunStatus,
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "completed":
      return "default";
    case "failed":
      return "destructive";
    case "running":
      return "default";
    case "initializing":
    case "queued":
      return "secondary";
    case "cancelled":
      return "outline";
    default:
      return "secondary";
  }
};

const getStatusColor = (status: CatalogerRunStatus): string => {
  switch (status) {
    case "completed":
      return "text-green-600";
    case "failed":
      return "text-red-600";
    case "running":
      return "text-blue-600";
    default:
      return "";
  }
};

export const CatalogerStatusBadge = ({
  status,
}: {
  status: CatalogerRunStatus;
}) => {
  return (
    <Badge
      variant={getStatusBadgeVariant(status)}
      className={cn("text-xs", getStatusColor(status))}
    >
      {status}
    </Badge>
  );
};
