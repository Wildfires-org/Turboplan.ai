"use client";

import Image from "next/image";

import type {
  PublicOfficeWithOrg,
  PublicOrganization,
} from "@wildfires-org/turboplan-public/types";

import { SECTION_LEAD_CLASS } from "@/components/home-v2/ui/section-header";
import { ProjectPromptInput } from "@/components/shared/project-prompt-input";
import { QUICK_START_OPTIONS } from "@/consts/quick-start-options";
import { cn } from "@/lib/utils";
import { CatalogHeaderShell } from "../catalog-header-shell";
import { CATALOG_H1_CLASS } from "../catalog-layout";

interface OfficeHeaderCardProps {
  organization: PublicOrganization;
  office: PublicOfficeWithOrg;
  className?: string;
}

export function OfficeHeaderCard({
  organization,
  office,
  className,
}: OfficeHeaderCardProps) {
  return (
    <CatalogHeaderShell
      coverImageUrl={office.coverImageUrl ?? organization.coverImageUrl}
      coverAlt={office.name}
      className={className}
    >
      <div className="mb-8 flex flex-col items-center gap-[18px] text-center sm:mb-10">
        <span className="glass inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-1.5 font-inter text-[13px] font-medium leading-[18px] text-egray-900">
          {organization.logoUrl?.trim() && (
            <Image
              src={organization.logoUrl.trim()}
              alt=""
              width={16}
              height={16}
              className="size-4 shrink-0 object-contain"
            />
          )}
          <span className="truncate">
            {organization.name}
            {organization.shortName ? ` (${organization.shortName})` : ""}
          </span>
        </span>
        <h1 className={CATALOG_H1_CLASS}>{office.name}</h1>
        {office.description && (
          <p className={cn(SECTION_LEAD_CLASS, "max-w-[640px]")}>
            {office.description}
          </p>
        )}
      </div>

      <ProjectPromptInput
        variant="input"
        label="Create a new project from prompt"
        quickStart={QUICK_START_OPTIONS}
        fallbackOfficeName={office.name}
      />
    </CatalogHeaderShell>
  );
}
