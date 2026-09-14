import { notFound } from "next/navigation";

import { CatalogOrganizationHero } from "@/components/catalog/catalog-organization-hero";
import { OfficesSection } from "@/components/catalog/organization-page/offices-section";
import { ProjectTemplatesSection } from "@/components/catalog/project-templates-section";
import { ProjectsSection } from "@/components/catalog/projects-section";
import { getOrganization } from "@/handlers/organizations";

interface OrganizationPageProps {
  params: Promise<{ organization: string }>;
}

export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  const { organization: organizationSlug } = await params;

  const organization = await getOrganization(organizationSlug);

  if (!organization) {
    notFound();
  }

  return (
    <div className="w-full">
      <CatalogOrganizationHero organization={organization} />

      <OfficesSection
        organizationId={organization.id}
        organizationSlug={organizationSlug}
      />

      <div className="px-4 md:px-8 lg:px-12">
        <div className="max-w-[1200px] mx-auto">
          <ProjectTemplatesSection
            organizationId={organization.id}
            organizationSlug={organizationSlug}
          />
        </div>
      </div>

      <div className="px-4 md:px-8 lg:px-12">
        <div className="max-w-[1200px] mx-auto">
          <ProjectsSection organizationSlug={organizationSlug} limit={3} />
        </div>
      </div>
    </div>
  );
}
