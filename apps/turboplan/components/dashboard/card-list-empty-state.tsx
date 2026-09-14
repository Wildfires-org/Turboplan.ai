import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

interface CardListEmptyStateProps {
  icon: LucideIcon;
  entityLabel: string;
  hasSearchTerm: boolean;
  createAction?: ReactNode;
}

export function CardListEmptyState({
  icon: Icon,
  entityLabel,
  hasSearchTerm,
  createAction,
}: CardListEmptyStateProps) {
  return (
    <div className="py-12 text-center text-muted-foreground">
      <Icon className="mx-auto mb-4 size-12 opacity-50" />
      <h3 className="mb-2 text-lg font-medium">
        {hasSearchTerm ? `No ${entityLabel} found` : `No ${entityLabel} yet`}
      </h3>
      <p className="mb-4 text-sm">
        {hasSearchTerm
          ? "Try adjusting your search terms to find what you're looking for."
          : `Create your first ${entityLabel.slice(0, -1)} to get started with organizing your work.`}
      </p>
      {!hasSearchTerm && createAction}
    </div>
  );
}
