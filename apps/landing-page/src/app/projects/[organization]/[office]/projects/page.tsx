import { notFound } from "next/navigation";

import { CATALOG_PAGE_CLASS } from "@/components/catalog/catalog-layout";
import { CatalogOfficeHero } from "@/components/catalog/catalog-office-hero";
import { ProjectsSection } from "@/components/catalog/projects-section";
import { getOffice } from "@/handlers/offices";
import { getOrganization } from "@/handlers/organizations";

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
    <div className={CATALOG_PAGE_CLASS}>
      <CatalogOfficeHero
        organization={organization}
        office={office}
        extraBreadcrumbs={[{ name: "Projects" }]}
      />

      <ProjectsSection
        organizationSlug={organizationSlug}
        officeSlug={officeSlug}
        limit={100}
        showMoreLink={false}
      />
    </div>
  );
}
