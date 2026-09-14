import { CatalogHero } from "@/components/catalog/catalog-hero";
import { ProjectTemplatesSection } from "@/components/catalog/project-templates-section";

export const dynamic = "force-dynamic";

export default function AllTemplatesPage() {
  return (
    <div className="w-full">
      <CatalogHero extraBreadcrumbs={[{ name: "All Templates" }]} />

      <div className="px-4 md:px-8 lg:px-12">
        <div className="max-w-[1200px] mx-auto">
          <ProjectTemplatesSection showMoreLink={false} />
        </div>
      </div>
    </div>
  );
}
