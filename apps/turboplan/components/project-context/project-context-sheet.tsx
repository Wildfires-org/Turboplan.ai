"use client";

import { ArrowRight, BookOpen, X } from "lucide-react";
import Link from "next/link";

import {
  isDocumentsPackageEnabled,
  isMapPackageEnabled,
  isProjectContextPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import { Button } from "@wildfires-org/turboplan-utils";

import { useOptionalDashboard } from "@/components/providers/dashboard-provider";
import { useUser } from "@/components/providers/user-provider";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useContextTabs } from "@/hooks/use-context-tabs";
import { GLASS_ICON_BUTTON_CLASS } from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import { cn } from "@/lib/utils";
import { ContextTabList, ContextTabPanels } from "./context-tabs";
import { ProjectContextDropzone } from "./project-context-dropzone";
import { ProjectDocumentsSection } from "./project-documents-section";
import { ProjectNotesSection } from "./project-notes-section";

interface ProjectContextSheetContentProps {
  projectId: string;
  userId: string;
  organization: { id: string; name: string; slug: string };
  contextPageHref: string;
}

interface ProjectTabProps {
  projectId: string;
  userId: string;
}

/** Same light green-tinted blur as the shared Dialog overlay. */
const OVERLAY_CLASS =
  "bg-[rgba(15,40,30,0.18)] backdrop-blur-sm dark:bg-black/60";

/** Full-height glass sheet on the page ground (so the glass cards inside
 * read), sliding in with a strong ease-out; reduced motion only fades. */
const SURFACE_CLASS = cn(
  "flex w-full flex-col gap-0 p-0 sm:max-w-md",
  "border-l-[1.5px] border-white bg-[#F4F9F7]/95 shadow-[-24px_0_64px_-32px_rgba(15,40,30,0.38),inset_1px_0_0_rgba(255,255,255,0.9)] backdrop-blur-2xl backdrop-saturate-150",
  "dark:border-white/10 dark:bg-slate-950/95",
  "ease-[cubic-bezier(0.23,1,0.32,1)] data-[state=closed]:duration-200 data-[state=open]:duration-300",
  "motion-reduce:data-[state=closed]:fade-out-0 motion-reduce:data-[state=open]:fade-in-0 motion-reduce:data-[state=closed]:slide-out-to-right-0 motion-reduce:data-[state=open]:slide-in-from-right-0",
);

const DIVIDER_CLASS = "border-slate-900/[0.06] dark:border-white/10";

/**
 * "Context" in the project chat header: opens a side sheet with the
 * project's Context in two tabs, Project and Organization, so files, notes,
 * the organization prompt and memory can be managed without leaving the
 * chat. The full Context page is one link away.
 */
export const ProjectContextSheet = () => {
  const dashboard = useOptionalDashboard();
  const { user } = useUser();

  const organization = dashboard?.organization ?? null;
  const office = dashboard?.office ?? null;
  const project = dashboard?.project ?? null;

  if (
    !isProjectContextPackageEnabled() ||
    !organization ||
    !office ||
    !project ||
    !user?.id
  ) {
    return null;
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="glass"
          className="h-9 w-9 gap-2 px-0 text-[14px] sm:w-auto sm:px-4"
        >
          <BookOpen aria-hidden />
          <span className="sr-only sm:not-sr-only">Context</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        hideCloseButton
        overlayClassName={OVERLAY_CLASS}
        className={SURFACE_CLASS}
      >
        <ProjectContextSheetContent
          projectId={project.id}
          userId={user.id}
          organization={organization}
          contextPageHref={AppUrls.projectContext(
            organization.slug,
            office.slug,
            project.slug,
          )}
        />
      </SheetContent>
    </Sheet>
  );
};

// Mounted only while the sheet is open, so its requests wait for a click.
const ProjectContextSheetContent = ({
  projectId,
  userId,
  organization,
  contextPageHref,
}: ProjectContextSheetContentProps) => {
  const tabsState = useContextTabs({
    userId,
    organizationId: organization.id,
    isOrganizationContextEnabled: true,
  });
  const description =
    tabsState.activeTab === "organization"
      ? `What the assistant knows about ${organization.name}.`
      : "What the assistant knows about this project.";

  return (
    <>
      <div className={cn("border-b px-4 pb-4 pt-5 sm:px-5", DIVIDER_CLASS)}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <SheetTitle className="text-[20px] font-medium leading-7 tracking-[-0.02em] text-foreground">
              Context
            </SheetTitle>
            <SheetDescription className="text-[13px] leading-5 text-gray-550 [overflow-wrap:anywhere]">
              {description}
            </SheetDescription>
          </div>
          <SheetClose className={cn(GLASS_ICON_BUTTON_CLASS, "size-9")}>
            <X aria-hidden className="size-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
        </div>
        <ContextTabList state={tabsState} isNarrow className="mt-4" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
        <ContextTabPanels
          state={tabsState}
          userId={userId}
          organization={organization}
          projectContent={<ProjectTab projectId={projectId} userId={userId} />}
          isNarrow
          className="space-y-4"
        />
      </div>

      <div className={cn("border-t px-4 py-3 sm:px-5", DIVIDER_CLASS)}>
        <SheetClose asChild>
          <Button asChild variant="glass" className="h-10 w-full">
            <Link href={contextPageHref}>
              Open full Context page
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </SheetClose>
      </div>
    </>
  );
};

/** The panel's Project tab: files for the AI, uploaded documents, notes. */
const ProjectTab = ({ projectId, userId }: ProjectTabProps) => {
  const isDocumentsEnabled = isDocumentsPackageEnabled();
  const isMapEnabled = isMapPackageEnabled();
  const { hasPermission: canEdit } = useEntityPermission({
    userId,
    entityType: EntityType.PROJECT,
    entityId: projectId,
    action: Action.UPDATE,
  });

  return (
    <>
      {canEdit && (isDocumentsEnabled || isMapEnabled) && (
        <ProjectContextDropzone
          projectId={projectId}
          acceptsDocuments={isDocumentsEnabled}
          acceptsGisLayers={isMapEnabled}
          isNarrow
        />
      )}
      {isDocumentsEnabled && (
        <ProjectDocumentsSection
          projectId={projectId}
          userId={userId}
          isNarrow
        />
      )}
      <ProjectNotesSection projectId={projectId} canEdit={canEdit} isNarrow />
    </>
  );
};
