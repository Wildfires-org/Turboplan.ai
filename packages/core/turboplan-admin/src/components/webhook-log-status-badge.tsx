"use client";

import { Badge, cn } from "@wildfires-org/turboplan-utils";

const getStatusColor = (status: number): string => {
  if (status >= 200 && status < 300) {
    return "text-green-600";
  }
  if (status >= 400 && status < 500) {
    return "text-yellow-600";
  }
  if (status >= 500) {
    return "text-red-600";
  }
  return "text-muted-foreground";
};

const getStatusBadgeVariant = (
  status: number,
): "default" | "secondary" | "destructive" | "outline" => {
  if (status >= 200 && status < 300) {
    return "default";
  }
  if (status >= 400 && status < 500) {
    return "outline";
  }
  if (status >= 500) {
    return "destructive";
  }
  return "secondary";
};

export const WebhookLogStatusBadge = ({ status }: { status: number }) => {
  return (
    <Badge
      variant={getStatusBadgeVariant(status)}
      className={cn("font-mono text-xs", getStatusColor(status))}
    >
      {status}
    </Badge>
  );
};
