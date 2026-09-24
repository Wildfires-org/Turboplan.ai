import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

import { SectionHeader } from "@/components/home-v2/ui/section-header";
import { cn } from "@/lib/utils";
import { CATALOG_HEADER_GAP_CLASS } from "./catalog-layout";

interface CatalogSectionHeaderProps {
  icon: LucideIcon;
  eyebrow: string;
  title: ReactNode;
  actions?: ReactNode;
}

// Start-aligned homepage section header with an optional actions slot.
export function CatalogSectionHeader({
  icon,
  eyebrow,
  title,
  actions,
}: CatalogSectionHeaderProps) {
  return (
    <div
      className={cn(
        CATALOG_HEADER_GAP_CLASS,
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
      )}
    >
      <SectionHeader
        icon={icon}
        eyebrow={eyebrow}
        title={title}
        align="start"
      />
      {actions && (
        <div className="flex shrink-0 items-center gap-3">{actions}</div>
      )}
    </div>
  );
}
