import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface OrganizationsSectionHeaderProps {
  className?: string;
}

export const ORGANIZATIONS_SECTION_DESCRIPTION = `${brand.name} helps federal land and resource management agencies move projects forward with tracking tools and NEPA document templates.`;

export function OrganizationsSectionHeader({
  className,
}: OrganizationsSectionHeaderProps) {
  return (
    <div className={cn(className)}>
      <h2 className="h2 text-center tracking-tight">Organizations</h2>
      <p className="text-center text-neutral-grey3 mt-5 max-w-xl mx-auto">
        {ORGANIZATIONS_SECTION_DESCRIPTION}
      </p>
    </div>
  );
}
