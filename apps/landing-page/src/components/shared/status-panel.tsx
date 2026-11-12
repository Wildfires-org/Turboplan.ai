import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";
import Image from "next/image";

import { CATALOG_H1_CLASS } from "@/components/catalog/catalog-layout";
import { PAGE_GUTTER } from "@/components/home-v2/ui/layout";
import {
  Eyebrow,
  SECTION_LEAD_CLASS,
} from "@/components/home-v2/ui/section-header";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface StatusPanelProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  lead: ReactNode;
  /** Show the brand mark above the eyebrow (the not-found pages). */
  showMark?: boolean;
  actions: ReactNode;
  children?: ReactNode;
}

// Centered glass panel for full-page states (404, not found, error).
export function StatusPanel({
  icon,
  eyebrow,
  title,
  lead,
  showMark = false,
  actions,
  children,
}: StatusPanelProps) {
  return (
    <section
      className={cn(
        PAGE_GUTTER,
        "flex min-h-[60vh] w-full items-center justify-center py-12 sm:py-16 lg:py-20",
      )}
    >
      <div className="glass-card w-full max-w-[640px] rounded-[28px] p-6 text-center sm:p-8 lg:p-10">
        <div className="flex flex-col items-center gap-[18px]">
          {showMark && (
            <Image
              src={brand.mark}
              alt=""
              width={56}
              height={56}
              className="size-12 sm:size-14"
            />
          )}
          <Eyebrow icon={icon} label={eyebrow} />
          <h1 className={CATALOG_H1_CLASS}>{title}</h1>
          <p className={cn(SECTION_LEAD_CLASS, "max-w-[480px]")}>{lead}</p>
        </div>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          {actions}
        </div>

        {children}
      </div>
    </section>
  );
}
