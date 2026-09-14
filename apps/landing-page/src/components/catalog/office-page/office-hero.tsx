"use client";

import type {
  PublicOfficeWithOrg,
  PublicOrganization,
} from "@wildfires-org/turboplan-public/types";
import { cn } from "@wildfires-org/turboplan-utils";

import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { routing } from "@/utils/routing";
import { getOrgCategoryLabel } from "../org-category";
import SearchBar from "../search-bar";
import type { BreadcrumbItem } from "../types";

interface OfficeHeroProps {
  organization: PublicOrganization;
  office: PublicOfficeWithOrg;
  extraBreadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export function OfficeHero({
  organization,
  office,
  extraBreadcrumbs,
  className,
}: OfficeHeroProps) {
  const hasExtra = extraBreadcrumbs && extraBreadcrumbs.length > 0;
  const breadcrumbItems: BreadcrumbItem[] = [
    { name: "Projects", href: routing.catalog() },
    { name: getOrgCategoryLabel(organization.type), href: routing.catalog() },
    {
      name: organization.shortName ?? organization.name,
      href: routing.catalogOrganization({
        organizationSlug: organization.slug,
      }),
    },
    {
      name: office.name,
      ...(hasExtra
        ? {
            href: routing.catalogOffice({
              organizationSlug: organization.slug,
              officeSlug: office.slug,
            }),
          }
        : {}),
    },
    ...(hasExtra ? extraBreadcrumbs : []),
  ];

  return (
    <section className={cn("relative rounded-2xl z-20", className)}>
      <div className="relative z-10 px-5 md:px-10">
        <div className="flex justify-center mb-6">
          <div className="bg-neutral-black/30 backdrop-blur-xs rounded-full px-4 py-2">
            <Breadcrumbs
              breadcrumbs={breadcrumbItems}
              className="text-white/80 text-sm"
            />
          </div>
        </div>

        <SearchBar
          placeholder={`Search ${office.name} projects...`}
          className="max-w-[920px] py-6"
        />
      </div>
    </section>
  );
}
