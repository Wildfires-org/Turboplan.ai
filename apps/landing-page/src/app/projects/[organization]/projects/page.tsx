import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogOrganizationHero } from "@/components/catalog/catalog-organization-hero";
import { ProjectsSection } from "@/components/catalog/projects-section";
import { getOrganization } from "@/handlers/organizations";
import { routing } from "@/utils/routing";

interface OrganizationProjectsPageProps {
  params: Promise<{ organization: string }>;
}

export default async function OrganizationProjectsPage({
  params,
}: OrganizationProjectsPageProps) {
  const { organization: organizationSlug } = await params;

  const organization = await getOrganization(organizationSlug);

  if (!organization) {
    notFound();
  }

  return (
    <div className="w-full">
      <CatalogOrganizationHero organization={organization} />

      <div className="px-4 md:px-8 lg:px-12">
        <div className="max-w-[1200px] mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-neutral-grey3 pt-6">
            <Link href={routing.catalog()} className="hover:text-neutral-black">
              Projects
            </Link>
            <span>/</span>
            <Link
              href={routing.catalogOrganization({ organizationSlug })}
              className="hover:text-neutral-black"
            >
              {organization.name}
            </Link>
            <span>/</span>
            <span className="text-neutral-black">Projects</span>
          </nav>

          <ProjectsSection
            organizationSlug={organizationSlug}
            showMoreLink={false}
          />
        </div>
      </div>
    </div>
  );
}
