import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

interface CatalogEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionButton: ReactNode;
}

export function CatalogEmptyState({
  icon: Icon,
  title,
  description,
  actionButton,
}: CatalogEmptyStateProps) {
  return (
    <div className="glass-card flex flex-col items-center justify-center rounded-[28px] px-6 py-12 text-center sm:px-8 sm:py-14 lg:py-16">
      <span
        aria-hidden
        className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 sm:size-[72px]"
      >
        <Icon className="size-7 sm:size-8" strokeWidth={1.75} />
      </span>
      <h3 className="mb-2 font-heading text-[22px] font-normal leading-[1.2] tracking-[-0.02em] text-egray-900 sm:text-[24px]">
        {title}
      </h3>
      <p className="mb-6 max-w-md font-inter text-[15px] leading-[22px] text-egray-700">
        {description}
      </p>
      {actionButton}
    </div>
  );
}
