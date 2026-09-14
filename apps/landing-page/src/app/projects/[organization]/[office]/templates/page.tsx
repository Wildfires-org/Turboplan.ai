import { notFound } from "next/navigation";

import { CatalogOfficeHero } from "@/components/catalog/catalog-office-hero";
import { ProjectTemplatesSection } from "@/components/catalog/project-templates-section";
import { getOffice } from "@/handlers/offices";
import { getOrganization } from "@/handlers/organizations";

interface OfficeTemplatesPageProps {
  params: Promise<{ organization: string; office: string }>;
}

export default async function OfficeTemplatesPage({
  params,
}: OfficeTemplatesPageProps) {
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
      <CatalogOfficeHero
        organization={organization}
        office={office}
        extraBreadcrumbs={[{ name: "Templates" }]}
      />

      <div className="px-4 md:px-8 lg:px-12">
        <div className="max-w-[1200px] mx-auto">
          <ProjectTemplatesSection
            organizationSlug={organizationSlug}
            officeSlug={officeSlug}
            showMoreLink={false}
          />
        </div>
      </div>
    </div>
  );
}
