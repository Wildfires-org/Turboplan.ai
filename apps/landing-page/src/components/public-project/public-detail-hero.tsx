import type { ReactNode } from "react";

import { Building2 } from "lucide-react";

import { CatalogHeaderShell } from "@/components/catalog/catalog-header-shell";
import {
  CATALOG_H1_CLASS,
  CATALOG_TOP_CLASS,
} from "@/components/catalog/catalog-layout";
import { CatalogToolbar } from "@/components/catalog/catalog-toolbar";
import type { BreadcrumbItem } from "@/components/catalog/types";
import { PAGE_CONTAINER } from "@/components/home-v2/ui/layout";
import { SECTION_LEAD_CLASS } from "@/components/home-v2/ui/section-header";
import { cn } from "@/lib/utils";

interface PublicDetailHeroProps {
  breadcrumbs: BreadcrumbItem[];
  searchPlaceholder: string;
  name: string;
  description: string | null;
  organizationName: string;
  officeName: string;
  updatedAt: string | null;
  coverImageUrl: string | null;
  badge?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

const formatUpdatedAt = (updatedAt: string | null): string | null => {
  if (!updatedAt) {
    return null;
  }

  return new Date(updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Toolbar + glass header shell for the public project / template pages.
export function PublicDetailHero({
  breadcrumbs,
  searchPlaceholder,
  name,
  description,
  organizationName,
  officeName,
  updatedAt,
  coverImageUrl,
  badge,
  actions,
  children,
}: PublicDetailHeroProps) {
  const formattedDate = formatUpdatedAt(updatedAt);

  return (
    <section className={CATALOG_TOP_CLASS}>
      <div className={PAGE_CONTAINER}>
        <CatalogToolbar
          breadcrumbs={breadcrumbs}
          searchPlaceholder={searchPlaceholder}
        />

        <CatalogHeaderShell
          coverImageUrl={coverImageUrl}
          coverAlt={name}
          className="mt-8 sm:mt-10"
        >
          <div className="flex flex-col items-center gap-[18px] text-center">
            <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
              <span className="glass inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-1.5 font-inter text-[13px] font-medium leading-[18px] text-egray-900">
                <Building2
                  className="size-4 shrink-0 text-brand-800"
                  aria-hidden
                />
                <span className="truncate">{organizationName}</span>
              </span>
              {badge}
            </div>

            <h1 className={cn(CATALOG_H1_CLASS, "max-w-full break-words")}>
              {name}
            </h1>

            {description && (
              <p className={cn(SECTION_LEAD_CLASS, "max-w-[640px]")}>
                {description}
              </p>
            )}

            <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-inter text-[14px] leading-[20px] text-egray-700">
              <span>{officeName}</span>
              {formattedDate && (
                <>
                  <span aria-hidden>·</span>
                  <span>Last modified {formattedDate}</span>
                </>
              )}
            </p>

            {actions && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                {actions}
              </div>
            )}
          </div>

          {children}
        </CatalogHeaderShell>
      </div>
    </section>
  );
}
