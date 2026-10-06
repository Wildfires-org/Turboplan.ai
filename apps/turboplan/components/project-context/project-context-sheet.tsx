"use client";

import { ArrowRight, BookOpen, X } from "lucide-react";
import Link from "next/link";

import {
  DocumentsSectionUI,
  useProjectDocuments,
} from "@wildfires-org/turboplan-documents/client";
import {
  isDocumentsPackageEnabled,
  isMapPackageEnabled,
  isProjectContextPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { Button } from "@wildfires-org/turboplan-utils";

import { OrganizationContextPanel } from "@/components/organization-context/organization-context-panel";
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
import { useOrganizationContextPermissions } from "@/hooks/use-organization-context-permissions";
import {
  GLASS_ICON_BUTTON_CLASS,
  PANEL_CLASS,
  PANEL_TITLE_CLASS,
} from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import { cn } from "@/lib/utils";
import { ContextUploadArea } from "./context-upload-area";

interface ProjectContextSheetBodyProps {
  projectId: string;
  userId: string;
  organization: { id: string; name: string; slug: string };
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
 * "Context" in the project chat header: opens a side sheet with what the
 * assistant knows about the project and its organization, so files can be
 * added (to the project or the organization) and notes or documents removed
 * without leaving the chat. The full Context page is one link away.
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
        <div
          className={cn(
            "flex items-start gap-3 border-b px-4 pb-4 pt-5 sm:px-5",
            DIVIDER_CLASS,
          )}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <SheetTitle className="text-[20px] font-medium leading-7 tracking-[-0.02em] text-foreground">
              Context
            </SheetTitle>
            <SheetDescription className="text-[13px] leading-5 text-gray-550 [overflow-wrap:anywhere]">
              What the assistant knows about this project and{" "}
              {organization.name}.
            </SheetDescription>
          </div>
          <SheetClose className={cn(GLASS_ICON_BUTTON_CLASS, "size-9")}>
            <X aria-hidden className="size-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <ProjectContextSheetBody
            projectId={project.id}
            userId={user.id}
            organization={organization}
          />
        </div>

        <div className={cn("border-t px-4 py-3 sm:px-5", DIVIDER_CLASS)}>
          <SheetClose asChild>
            <Button asChild variant="glass" className="h-10 w-full">
              <Link
                href={AppUrls.projectContext(
                  organization.slug,
                  office.slug,
                  project.slug,
                )}
              >
                Open full Context page
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Mounted only while the sheet is open, so its requests wait for a click.
const ProjectContextSheetBody = ({
  projectId,
  userId,
  organization,
}: ProjectContextSheetBodyProps) => {
  const isDocumentsEnabled = isDocumentsPackageEnabled();
  const { canEditOrganization, canReadOrganization } =
    useOrganizationContextPermissions({
      userId,
      organizationId: organization.id,
    });
  const { documents: uploadedDocuments } = useProjectDocuments({
    projectId,
    source: "upload",
  });

  return (
    <>
      <ContextUploadArea
        projectId={projectId}
        userId={userId}
        organization={organization}
        isDocumentsEnabled={isDocumentsEnabled}
        isMapEnabled={isMapPackageEnabled()}
        isOrganizationContextEnabled
        isNarrow
      />

      {canReadOrganization && (
        <OrganizationContextPanel
          organizationId={organization.id}
          organizationName={organization.name}
          orgSlug={organization.slug}
          canEdit={canEditOrganization}
          isNarrow
        />
      )}

      {isDocumentsEnabled && uploadedDocuments.length > 0 && (
        <section className={cn(PANEL_CLASS, "space-y-4")}>
          <div>
            <h3 className={PANEL_TITLE_CLASS}>Project documents</h3>
            <p className="text-[13px] leading-5 text-gray-550">
              Files added to this project. The assistant reads their text once
              extracted.
            </p>
          </div>
          {/* The only poller of this list in the sheet; the dropzone rows
              above read the same SWR cache. */}
          <DocumentsSectionUI
            projectId={projectId}
            userId={userId}
            source="upload"
            showExtractionStatus
            singleColumn
          />
        </section>
      )}
    </>
  );
};
