import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

interface CardListEmptyStateProps {
  icon: LucideIcon;
  entityLabel: string;
  hasSearchTerm: boolean;
  createAction?: ReactNode;
  /** Replaces the default "create your first ..." hint (no search term). */
  emptyDescription?: string;
}

export function CardListEmptyState({
  icon: Icon,
  entityLabel,
  hasSearchTerm,
  createAction,
  emptyDescription,
}: CardListEmptyStateProps) {
  return (
    <div className="glass-card flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-brandAlt-100 text-brand-800">
        <Icon aria-hidden className="size-6" />
      </span>
      <h3 className="mb-1.5 text-lg font-medium tracking-[-0.02em] text-foreground">
        {hasSearchTerm ? `No ${entityLabel} found` : `No ${entityLabel} yet`}
      </h3>
      <p className="mb-5 max-w-[420px] text-sm text-gray-550">
        {hasSearchTerm
          ? "Try adjusting your search terms to find what you're looking for."
          : (emptyDescription ??
            `Create your first ${entityLabel.slice(0, -1)} to get started with organizing your work.`)}
      </p>
      {!hasSearchTerm && createAction}
    </div>
  );
}
