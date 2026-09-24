import { ArrowRight, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { PublicProject } from "@/types/public-project";
import { routing } from "@/utils/routing";
import {
  CARD_ACTION_CLASS,
  CARD_ACTION_ICON_CLASS,
  CARD_CHIP_CLASS,
  CATALOG_CARD_LINK_CLASS,
} from "./catalog-layout";

interface TemplateCardProps {
  template: PublicProject;
  className?: string;
}

// Same shell as ProjectCard so templates and projects read as one system.
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
    <Link
      href={templateUrl}
      className={cn(CATALOG_CARD_LINK_CLASS, "flex flex-col", className)}
    >
      <div className="p-2 pb-0">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-brandAlt-100">
          {template.coverImageUrl ? (
            <Image
              src={template.coverImageUrl}
              alt={template.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="size-8 text-brand-800/30" />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <span className={cn(CARD_CHIP_CLASS, "mb-4 self-start text-brand-800")}>
          Template
        </span>
        <h3
          className="mb-2 line-clamp-2 font-inter text-[16px] font-medium leading-[22px] text-egray-900"
          title={template.name}
        >
          {template.name}
        </h3>
        {template.description && (
          <p
            className="line-clamp-3 font-inter text-[14px] leading-[20px] text-egray-700"
            title={template.description}
          >
            {template.description}
          </p>
        )}

        <div className="mt-auto pt-5">
          <span className={CARD_ACTION_CLASS}>
            Start project
            <ArrowRight aria-hidden className={CARD_ACTION_ICON_CLASS} />
          </span>
        </div>
      </div>
    </Link>
  );
}
