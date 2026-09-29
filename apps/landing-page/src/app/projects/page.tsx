import { CatalogHero } from "@/components/catalog/catalog-hero";
import { CATALOG_PAGE_CLASS } from "@/components/catalog/catalog-layout";
import { ProjectsSection } from "@/components/catalog/projects-section";

export const dynamic = "force-dynamic";

export default function CatalogPage() {
  return (
    <div className={CATALOG_PAGE_CLASS}>
      <CatalogHero />
      <ProjectsSection limit={3} />
    </div>
  );
}
