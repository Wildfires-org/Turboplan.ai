import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

interface ReadOnlyPreviewDetailsProps {
  name: string;
  description: string | null;
  organizationName: string;
  updatedAt: string | null;
  badge?: ReactNode;
  titleActions?: ReactNode;
  detailsSlot?: ReactNode;
}

function formatUpdatedAt(updatedAt: string | null): string | null {
  if (!updatedAt) {
    return null;
  }

  return new Date(updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ReadOnlyPreviewDetails({
  name,
  description,
  organizationName,
  updatedAt,
  badge,
  titleActions,
  detailsSlot,
}: ReadOnlyPreviewDetailsProps) {
  const formattedDate = formatUpdatedAt(updatedAt);

  return (
    <div className="space-y-2 mt-8">
      <div className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold">{name}</h1>
            {badge}
          </div>
          {titleActions}
        </div>
      </div>
      {description && <p className="text-sm">{description}</p>}
      <div className="flex items-center gap-4 !mt-4">
        <div className="flex items-center gap-2 text-sm">
          {detailsSlot}
          <Badge variant="secondary">{organizationName}</Badge>
        </div>
        {formattedDate && (
          <div className="flex items-center text-xs text-muted-foreground gap-1">
            <span>Last modified: {formattedDate}</span>
          </div>
        )}
      </div>
    </div>
  );
}
