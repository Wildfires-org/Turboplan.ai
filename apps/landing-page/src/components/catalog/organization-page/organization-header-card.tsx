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
import { cn } from "@wildfires-org/turboplan-utils";

import { ProjectPromptInput } from "@/components/shared/project-prompt-input";
import { Button } from "@/components/ui/button";
import { QUICK_START_OPTIONS } from "@/consts/quick-start-options";

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
    <div
      className={cn(
        "bg-white/95 p-4 md:p-12 max-w-[1080px] mx-auto flex flex-col justify-center drop-shadow",
        className,
      )}
    >
      <div className="max-w-screen-md mx-auto w-full">
        {/* Organization header */}
        <div className="flex flex-col items-center text-center mb-4 md:mb-10">
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
            {organization.logoUrl?.trim() ? (
              <Image
                src={organization.logoUrl.trim()}
                alt={`${organization.name} logo`}
                width={64}
                height={64}
                className="object-contain w-10 h-10 md:w-16 md:h-16"
              />
            ) : (
              <div className="w-10 h-10 md:w-16 md:h-16 bg-gray-150 rounded flex items-center justify-center text-sm md:text-lg font-medium text-neutral-grey3">
                {organization.name.slice(0, 2)}
              </div>
            )}
            <h1 className="text-lg md:h2 font-semibold text-center tracking-tight">
              {organization.name}
            </h1>
          </div>
          {organization.description && (
            <p className="text-center text-neutral-grey3 mt-3 md:mt-5 max-w-xl mx-auto text-sm md:text-base">
              {organization.description}
            </p>
          )}
        </div>

        {/* Project prompt input */}
        <ProjectPromptInput
          variant="input"
          label="Create a new project from prompt"
          quickStart={QUICK_START_OPTIONS}
          className="mb-4 md:mb-8"
        />

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-3">
          {actionButtons.map((button) => {
            const Icon = button.icon;
            return (
              <Button
                key={button.id}
                variant="tertiary"
                size="small"
                className="justify-center text-xs md:text-sm rounded-full px-3 md:px-4"
                onClick={button.onClick}
              >
                <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-2 shrink-0" />
                <span>{button.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
