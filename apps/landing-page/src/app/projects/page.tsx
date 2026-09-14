import { CatalogHero } from "@/components/catalog/catalog-hero";
import { ProjectsSection } from "@/components/catalog/projects-section";

export const dynamic = "force-dynamic";

export default function CatalogPage() {
  return (
    <div className="w-full">
      <CatalogHero />
      <ProjectsSection limit={3} />
    </div>
  );
}
