"use client";

import {
  ExternalLink,
  FileText,
  FolderOpen,
  Layers,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";

import type { PublicOrganization } from "@wildfires-org/turboplan-public/types";

import { SECTION_LEAD_CLASS } from "@/components/home-v2/ui/section-header";
import { ProjectPromptInput } from "@/components/shared/project-prompt-input";
import { QUICK_START_OPTIONS } from "@/consts/quick-start-options";
import { cn } from "@/lib/utils";
import { CatalogHeaderShell } from "../catalog-header-shell";
import { CATALOG_H1_CLASS, GLASS_BUTTON_CLASS } from "../catalog-layout";

interface ActionButton {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
}

// TODO: Implement navigation/actions for these buttons
const DEFAULT_ACTION_BUTTONS: ActionButton[] = [
  {
    id: "create-projects",
    label: "Create Projects",
    icon: ExternalLink,
  },
  {
    id: "discover-offices",
    label: "Discover Offices",
    icon: FolderOpen,
  },
  {
    id: "choose-templates",
    label: "Choose Templates",
    icon: FileText,
  },
  {
    id: "browse-projects",
    label: "Browse Projects",
    icon: Layers,
  },
];

interface OrganizationHeaderCardProps {
  organization: PublicOrganization;
  actionButtons?: ActionButton[];
  className?: string;
}

export function OrganizationHeaderCard({
  organization,
  actionButtons = DEFAULT_ACTION_BUTTONS,
  className,
}: OrganizationHeaderCardProps) {
  return (
    <CatalogHeaderShell
      coverImageUrl={organization.coverImageUrl}
      coverAlt={organization.name}
      className={className}
    >
      <div className="mb-8 flex flex-col items-center gap-4 text-center sm:mb-10">
        {organization.logoUrl?.trim() ? (
          <Image
            src={organization.logoUrl.trim()}
            alt={`${organization.name} logo`}
            width={64}
            height={64}
            className="size-12 object-contain md:size-16"
          />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-xl bg-brandAlt-100 font-heading text-sm font-medium text-brand-800 md:size-16 md:text-lg">
            {organization.name.slice(0, 2)}
          </div>
        )}
        <h1 className={CATALOG_H1_CLASS}>{organization.name}</h1>
        {organization.description && (
          <p className={cn(SECTION_LEAD_CLASS, "max-w-[640px]")}>
            {organization.description}
          </p>
        )}
      </div>

      <ProjectPromptInput
        variant="input"
        label="Create a new project from prompt"
        quickStart={QUICK_START_OPTIONS}
      />

      <div className="mt-6 flex flex-wrap justify-center gap-2 sm:mt-8 sm:gap-3">
        {actionButtons.map((button) => {
          const Icon = button.icon;
          return (
            <button
              type="button"
              key={button.id}
              className={GLASS_BUTTON_CLASS}
              onClick={button.onClick}
            >
              <Icon className="size-4 shrink-0" />
              <span>{button.label}</span>
            </button>
          );
        })}
      </div>
    </CatalogHeaderShell>
  );
}
