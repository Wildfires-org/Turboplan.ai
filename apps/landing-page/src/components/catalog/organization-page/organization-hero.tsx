import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";
import { getOrgCategoryLabel } from "../org-category";
import SearchBar from "../search-bar";
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
          placeholder={`Search ${organizationAbbreviation} offices and projects...`}
          className="max-w-[920px] py-6"
        />
      </div>
    </section>
  );
}
