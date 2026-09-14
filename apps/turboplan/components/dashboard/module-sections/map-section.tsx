"use client";

import { Map } from "lucide-react";

import {
  MapContentManager,
  MapControls,
} from "@wildfires-org/turboplan-map/client";

import { AppUrls } from "@/lib/nav/urls";
import { SectionCard } from "../../section-card";
import type { DragHandleProps } from "../sortable-module";

interface MapSectionProps {
  projectId: string;
  organizationSlug: string;
  officeSlug: string;
  projectSlug: string;
  isHidden: boolean;
  isToggling: boolean;
  onToggleVisibility: () => void;
  isPrivate: boolean;
  isTogglingPublicVisibility: boolean;
  onTogglePublicVisibility?: () => void;
  dragHandleProps?: DragHandleProps;
  /** When true, hides edit controls */
  readOnly?: boolean;
}

export function MapSection({
  projectId,
  organizationSlug,
  officeSlug,
  projectSlug,
  isHidden,
  isToggling,
  onToggleVisibility,
  isPrivate,
  isTogglingPublicVisibility,
  onTogglePublicVisibility,
  dragHandleProps,
  readOnly = false,
}: MapSectionProps) {
  return (
    <SectionCard
      title="Map"
      icon={<Map className="size-4" aria-hidden />}
      actionLink={{
        label: "Go to map",
        href: AppUrls.projectMap(organizationSlug, officeSlug, projectSlug),
      }}
      controls={<MapControls projectId={projectId} />}
      onToggleVisibility={onToggleVisibility}
      isHidden={isHidden}
      isTogglingVisibility={isToggling}
      onTogglePublicVisibility={onTogglePublicVisibility}
      isPrivate={isPrivate}
      isTogglingPublicVisibility={isTogglingPublicVisibility}
      dragHandleProps={dragHandleProps}
      readOnly={readOnly}
    >
      <MapContentManager projectId={projectId} readOnly={readOnly} />
    </SectionCard>
  );
}
