"use client";

import type {
  PublicOfficeWithOrg,
  PublicOrganization,
} from "@wildfires-org/turboplan-public/types";

import { routing } from "@/utils/routing";
import { CatalogToolbar } from "../catalog-toolbar";
import { getOrgCategoryLabel } from "../org-category";
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
    <CatalogToolbar
      breadcrumbs={breadcrumbItems}
      searchPlaceholder={`Search ${office.name} projects...`}
      className={className}
    />
  );
}
