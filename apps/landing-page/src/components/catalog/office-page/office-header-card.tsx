"use client";

import Image from "next/image";

import type {
  PublicOfficeWithOrg,
  PublicOrganization,
} from "@wildfires-org/turboplan-public/types";
import { cn } from "@wildfires-org/turboplan-utils";

import { ProjectPromptInput } from "@/components/shared/project-prompt-input";
import { Badge } from "@/components/ui/badge";
import { QUICK_START_OPTIONS } from "@/consts/quick-start-options";

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
    <div
      className={cn(
        "bg-white/95 rounded-t-3xl p-4 md:p-12 max-w-[1080px] mx-auto flex flex-col justify-center drop-shadow",
        className,
      )}
    >
      <div className="max-w-screen-md mx-auto w-full">
        <div className="flex flex-col items-center text-center gap-5 mb-4 md:mb-10">
          <Badge
            variant="lightGray"
            className="flex items-center gap-2 w-fit rounded-full px-4 py-2 text-sm font-medium text-neutral-black"
          >
            {organization.logoUrl?.trim() && (
              <Image
                src={organization.logoUrl.trim()}
                alt={`${organization.name} logo`}
                width={16}
                height={16}
                className="object-contain"
              />
            )}
            {organization.name}
            {organization.shortName ? ` (${organization.shortName})` : ""}
          </Badge>
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
            <h1 className="text-lg md:h2 font-semibold text-center tracking-tight">
              {office.name}
            </h1>
          </div>
          {office.description && (
            <div className="flex items-center gap-1 md:mt-5">
              <span className="text-neutral-grey3 text-sm md:text-base">
                {office.description}
              </span>
            </div>
          )}
        </div>

        <ProjectPromptInput
          variant="input"
          label="Create a new project from prompt"
          quickStart={QUICK_START_OPTIONS}
          fallbackOfficeName={office.name}
        />
      </div>
    </div>
  );
}
