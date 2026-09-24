import { Suspense } from "react";

import { Landmark } from "lucide-react";

import { OrganizationsSection } from "@/components/catalog/organizations-section";
import { OrganizationsSectionSkeleton } from "@/components/catalog/organizations-section-skeleton";
import { PAGE_CONTAINER } from "@/components/home-v2/ui/layout";
import {
  Eyebrow,
  HEADER_STACK_CLASS,
  SECTION_LEAD_CLASS,
} from "@/components/home-v2/ui/section-header";
import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";
import {
  CATALOG_H1_CLASS,
  CATALOG_HEADER_GAP_CLASS,
  CATALOG_TOP_CLASS,
} from "./catalog-layout";
import { CatalogToolbar } from "./catalog-toolbar";
import { ORGANIZATIONS_SECTION_DESCRIPTION } from "./organizations-section-header";
import type { BreadcrumbItem } from "./types";

interface CatalogHeroProps {
  extraBreadcrumbs?: BreadcrumbItem[];
}

// Catalog index header on the flat Mist ground: breadcrumb + search, page
// title, then the organizations grid.
export function CatalogHero({ extraBreadcrumbs }: CatalogHeroProps = {}) {
  const hasExtra = extraBreadcrumbs && extraBreadcrumbs.length > 0;
  const breadcrumbItems: BreadcrumbItem[] = [
    { name: "Projects", ...(hasExtra ? { href: routing.catalog() } : {}) },
    {
      name: "Organizations",
      ...(hasExtra ? { href: routing.catalog() } : {}),
    },
    ...(hasExtra ? extraBreadcrumbs : []),
  ];

  return (
    <section className={CATALOG_TOP_CLASS}>
      <div className={PAGE_CONTAINER}>
        <CatalogToolbar breadcrumbs={breadcrumbItems} />

        <div
          className={cn(
            HEADER_STACK_CLASS,
            CATALOG_HEADER_GAP_CLASS,
            "mx-auto mt-12 max-w-[760px] items-center text-center sm:mt-16",
          )}
        >
          <Eyebrow icon={Landmark} label="Public catalog" />
          <h1 className={CATALOG_H1_CLASS}>
            Browse <span className="text-brand-700">organizations</span>
          </h1>
          <p className={cn(SECTION_LEAD_CLASS, "max-w-[640px]")}>
            {ORGANIZATIONS_SECTION_DESCRIPTION}
          </p>
        </div>

        <Suspense fallback={<OrganizationsSectionSkeleton />}>
          <OrganizationsSection />
        </Suspense>
      </div>
    </section>
  );
}
