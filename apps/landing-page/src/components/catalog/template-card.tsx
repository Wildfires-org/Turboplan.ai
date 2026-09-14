import Link from "next/link";

import { TemplateCard as SharedTemplateCard } from "@wildfires-org/turboplan-utils";

import Arrow from "@/components/icons/arrow";
import { Button } from "@/components/ui/button";
import type { PublicProject } from "@/types/public-project";
import { routing } from "@/utils/routing";

interface TemplateCardProps {
  template: PublicProject;
  className?: string;
}

export default function TemplateCard({
  template,
  className,
}: TemplateCardProps) {
  const templateUrl = routing.catalogTemplate({
    organizationSlug: template.organization.slug,
    officeSlug: template.office.slug,
    templateSlug: template.slug,
  });

  return (
    <SharedTemplateCard
      name={template.name}
      description={template.description}
      imageUrl={template.coverImageUrl}
      className={className}
      actionSlot={
        <Button
          asChild
          variant="outline"
          size="small"
          className="group w-full justify-center hover:bg-green-60 hover:text-white"
          rightIcon={() => (
            <Arrow
              size={14}
              className="ml-1 group-hover:translate-x-1 transition-transform"
            />
          )}
        >
          <Link href={templateUrl}>Start project</Link>
        </Button>
      }
    />
  );
}
