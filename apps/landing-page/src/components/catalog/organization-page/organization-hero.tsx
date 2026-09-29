import { routing } from "@/utils/routing";
import { CatalogToolbar } from "../catalog-toolbar";
import { getOrgCategoryLabel } from "../org-category";
import type { BreadcrumbItem } from "../types";

interface OrganizationHeroProps {
  organizationAbbreviation: string;
  organizationSlug?: string;
  organizationType?: string;
  extraBreadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export function OrganizationHero({
  organizationAbbreviation,
  organizationSlug,
  organizationType,
  extraBreadcrumbs,
  className,
}: OrganizationHeroProps) {
  const hasExtra = extraBreadcrumbs && extraBreadcrumbs.length > 0;
  const breadcrumbItems: BreadcrumbItem[] = [
    { name: "Projects", href: routing.catalog() },
    { name: getOrgCategoryLabel(organizationType), href: routing.catalog() },
    {
      name: organizationAbbreviation.toUpperCase(),
      ...(hasExtra && organizationSlug
        ? {
            href: routing.catalogOrganization({ organizationSlug }),
          }
        : {}),
    },
    ...(hasExtra ? extraBreadcrumbs : []),
  ];

  return (
    <CatalogToolbar
      breadcrumbs={breadcrumbItems}
      searchPlaceholder={`Search ${organizationAbbreviation} offices and projects...`}
      className={className}
    />
  );
}
