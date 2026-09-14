import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogOfficeHero } from "@/components/catalog/catalog-office-hero";
import { ProjectsSection } from "@/components/catalog/projects-section";
import { getOffice } from "@/handlers/offices";
import { getOrganization } from "@/handlers/organizations";
import { routing } from "@/utils/routing";

interface OfficeProjectsPageProps {
  params: Promise<{ organization: string; office: string }>;
}

export default async function OfficeProjectsPage({
  params,
}: OfficeProjectsPageProps) {
  const { organization: organizationSlug, office: officeSlug } = await params;

  const [organization, office] = await Promise.all([
    getOrganization(organizationSlug),
    getOffice(organizationSlug, officeSlug),
  ]);

  if (!organization || !office) {
    notFound();
  }

  return (
    <div className="w-full">
      <CatalogOfficeHero organization={organization} office={office} />

      <div className="px-4 md:px-8 lg:px-12">
        <div className="max-w-[1200px] mx-auto">
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
            <Link
              href={routing.catalogOffice({ organizationSlug, officeSlug })}
              className="hover:text-neutral-black"
            >
              {office.name}
            </Link>
            <span>/</span>
            <span className="text-neutral-black">Projects</span>
          </nav>

          <ProjectsSection
            organizationSlug={organizationSlug}
            officeSlug={officeSlug}
            limit={100}
            showMoreLink={false}
          />
        </div>
      </div>
    </div>
  );
}
