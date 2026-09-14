import { Suspense } from "react";

import Image from "next/image";

import CatalogHeroImage from "@/../public/home/catalog-hero.png";
import { OrganizationsSection } from "@/components/catalog/organizations-section";
import { OrganizationsSectionSkeleton } from "@/components/catalog/organizations-section-skeleton";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";
import SearchBar from "./search-bar";
import type { BreadcrumbItem } from "./types";

function CatalogHeroContent({
  className,
  extraBreadcrumbs,
}: {
  className?: string;
  extraBreadcrumbs?: BreadcrumbItem[];
}) {
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
    <section className={cn("relative rounded-2xl", className)}>
      <div className="relative z-10 px-5 md:px-10">
        <div className="flex justify-center py-1">
          <div className="bg-neutral-black/30 backdrop-blur-xs rounded-full px-4 py-2">
            <Breadcrumbs
              breadcrumbs={breadcrumbItems}
              className="text-white/80 text-sm"
            />
          </div>
        </div>

        <SearchBar className="max-w-[920px] py-6" />
      </div>
    </section>
  );
}

interface CatalogHeroProps {
  extraBreadcrumbs?: BreadcrumbItem[];
}

export function CatalogHero({ extraBreadcrumbs }: CatalogHeroProps = {}) {
  return (
    <section className="flex flex-col bg-gray-500 px-4 -mt-[88px] pt-8 pb-0 relative overflow-hidden max-md:-mx-5 rounded-t-3xl">
      <CatalogHeroContent
        className="z-20"
        extraBreadcrumbs={extraBreadcrumbs}
      />
      <Suspense fallback={<OrganizationsSectionSkeleton className="z-10" />}>
        <OrganizationsSection className="z-10" />
      </Suspense>
      <Image
        src={CatalogHeroImage}
        alt="Catalog Hero"
        fill
        className="object-cover z-0 absolute inset-0 w-full"
      />
    </section>
  );
}
