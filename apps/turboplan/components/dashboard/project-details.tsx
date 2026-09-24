"use client";

import { useMemo, useState } from "react";

import { formatDistanceToNow } from "date-fns";
import { Copy, ImageIcon, MoreVertical, Pencil, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";

import { OwnershipStatus } from "@wildfires-org/turboplan-db/types";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@wildfires-org/turboplan-utils";
import {
  InviteMembersDialog,
  useMemberManagement,
} from "@wildfires-org/turboplan-workspace/client";
import type { Project } from "@wildfires-org/turboplan-workspace/types";

import { LockIcon } from "@/components/icons";
import { useIsCitizen } from "@/hooks/use-citizen-mode";
import { useCreateTemplate } from "@/hooks/use-create-template";
import { useSeatBillingActive } from "@/hooks/use-seat-billing-active";
import { useSendInvitations } from "@/hooks/use-send-invitations";
import {
  CHIP_BASE_CLASS,
  CHIP_TONE_CLASS,
  HEADER_ACTION_BUTTON_CLASS,
  PAGE_LEAD_CLASS,
  PAGE_TITLE_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";
import { CreateTemplateDialog } from "./create-template-dialog";
import { EditProjectDialog } from "./edit-project-dialog";
import { ProjectMembersDisplay } from "./project-members-display";
import { SubmitApplicationDialog } from "./submit-application-dialog";

interface ProjectDetailsProps {
  project: Project;
  user?: User;
  organizationSlug?: string;
  officeSlug?: string;
  /** Optional badge rendered next to the title (e.g. "Template" label) */
  badge?: React.ReactNode;
  /** Overrides the default dropdown menu. Pass explicit JSX or null to hide. */
  headerActions?: React.ReactNode;
  /** Whether to show members section. Defaults to true. */
  showMembers?: boolean;
  /** URL to navigate to when members avatars are clicked */
  membersHref?: string;
  /**
   * Avatar/logo rendered to the left of the project name (e.g. inside the
   * overlapping header card). When omitted, no avatar is rendered.
   */
  avatar?: React.ReactNode;
  /**
   * Extra controls rendered in the right action cluster, before the Submit
   * button and `⋮` menu (e.g. Export button + visibility eye on the project
   * page header card).
   */
  extraActions?: React.ReactNode;
  /**
   * Content rendered between the description and the members row (e.g. the
   * project progress bar inside the header card).
   */
  progressSlot?: React.ReactNode;
  /**
   * When provided (and the viewer has UPDATE permission), adds an "Edit cover"
   * item to the `⋮` menu that invokes this callback.
   */
  onEditCover?: () => void;
  /**
   * True when this project is being viewed in the owner's personal workspace.
   * Self-service/landing-page users have no `citizen` role, so the submit
   * button cannot rely on `isCitizen`; in a personal workspace the viewer is the
   * owner of the draft and may submit it for review.
   */
  isPersonalWorkspace?: boolean;
  /** Classes for the root row (spacing inside the host card). */
  className?: string;
}

export function ProjectDetails({
  project,
  user,
  organizationSlug,
  officeSlug,
  badge,
  headerActions,
  showMembers = true,
  membersHref,
  avatar,
  extraActions,
  progressSlot,
  onEditCover,
  isPersonalWorkspace = false,
  className,
}: ProjectDetailsProps) {
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const router = useRouter();
  const isCitizen = useIsCitizen();

  const { hasPermission: canUpdate } = useEntityPermission({
    userId: user?.id,
    entityType: EntityType.PROJECT,
    entityId: project.id,
    action: Action.UPDATE,
  });

  const { hasPermission: canManageMembers } = useEntityPermission({
    userId: user?.id,
    entityType: EntityType.PROJECT,
    entityId: project.id,
    action: Action.MANAGE_MEMBERS,
  });

  // Fetch project members
  const { members, isLoading, addMember, mutate } = useMemberManagement({
    entityType: EntityType.PROJECT,
    entityId: project.id,
    enabled: showMembers,
  });

  const { handleSendInvitations, isSending: isSendingInvites } =
    useSendInvitations({
      addMember,
      onSuccess: () => {
        mutate();
        setShowInviteDialog(false);
      },
    });

  const existingEmails = useMemo(
    () => new Set(members.map((m) => m.user.email.toLowerCase())),
    [members],
  );

  // Owner/Editor invites consume a paid seat when the project's org has active
  // billing. Resolved server-side from the project id; only while the dialog is open.
  const seatBillingActive = useSeatBillingActive(
    EntityType.PROJECT,
    project.id,
    showInviteDialog,
  );

  const { createTemplate, isCreating: isCreatingTemplate } = useCreateTemplate(
    project.id,
  );

  const handleCreateTemplate = async (data: {
    name: string;
    description: string;
  }) => {
    try {
      await createTemplate(data);
      toast({ type: "success", description: "Template created successfully" });
      setShowTemplateDialog(false);
    } catch {
      toast({ type: "error", description: "Failed to create template" });
    }
  };

  // For citizens with a submitted/accepted/rejected project, hide the dropdown entirely
  const citizenHasSubmitted =
    isCitizen &&
    project.ownershipStatus !== null &&
    project.ownershipStatus !== OwnershipStatus.DRAFT;

  // The owner may submit a non-template DRAFT for review. Gate on either the
  // global citizen role (gov-context proposals) OR a personal-workspace view
  // (self-service/landing-page projects, whose owners have no citizen role).
  const canSubmitForReview =
    (isCitizen || isPersonalWorkspace) &&
    !project.isTemplate &&
    (!project.ownershipStatus ||
      project.ownershipStatus === OwnershipStatus.DRAFT);

  const hasAnyAction = canUpdate || canManageMembers;

  const ownershipStatusLabel = useMemo(() => {
    const labels: Record<string, string> = {
      [OwnershipStatus.SUBMITTED]: "Submitted",
      [OwnershipStatus.ACCEPTED]: "Accepted",
      [OwnershipStatus.REJECTED]: "Rejected",
    };
    if (!project.ownershipStatus) {
      return null;
    }
    return labels[project.ownershipStatus] ?? null;
  }, [project.ownershipStatus]);

  const defaultActions =
    !project.isTemplate && !citizenHasSubmitted && hasAnyAction ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="glass"
            size="icon"
            aria-label="Project actions"
            className="size-9 text-foreground data-[state=open]:bg-white/90"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end">
          {canUpdate && organizationSlug && officeSlug && (
            <DropdownMenuItem onSelect={() => setShowEditDialog(true)}>
              <Pencil className="mr-2 size-4" />
              Edit project
            </DropdownMenuItem>
          )}
          {canUpdate && onEditCover && (
            <DropdownMenuItem onSelect={() => onEditCover()}>
              <ImageIcon className="mr-2 size-4" />
              Edit cover
            </DropdownMenuItem>
          )}
          {canUpdate && (
            <DropdownMenuItem onSelect={() => setShowTemplateDialog(true)}>
              <Copy className="mr-2 size-4" />
              Create template from project
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <>
      {/* Left column = avatar + title/progress/members; actions = right column */}
      <div
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {avatar}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Title block */}
            <div className="flex flex-col gap-2">
              {!project.isTemplate && !isCitizen && (
                <span
                  className={cn(
                    CHIP_BASE_CLASS,
                    "w-fit bg-slate-900 text-white [&_svg]:size-3",
                  )}
                >
                  <LockIcon size={12} />
                  Manager view
                </span>
              )}
              <h1
                className={cn(
                  PAGE_TITLE_CLASS,
                  "flex flex-wrap items-center gap-x-3 gap-y-1",
                )}
              >
                <span className="min-w-0">{project.name}</span>
                {badge}
                {isCitizen && ownershipStatusLabel && (
                  <span
                    className={cn(
                      CHIP_BASE_CLASS,
                      "h-6 px-2.5 text-[12px] tracking-normal",
                      project.ownershipStatus === OwnershipStatus.SUBMITTED &&
                        "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-800/15",
                      project.ownershipStatus === OwnershipStatus.ACCEPTED &&
                        CHIP_TONE_CLASS.brand,
                      project.ownershipStatus === OwnershipStatus.REJECTED &&
                        CHIP_TONE_CLASS.danger,
                    )}
                  >
                    {ownershipStatusLabel}
                  </span>
                )}
              </h1>
            </div>
            {project.description && (
              <p className={cn(PAGE_LEAD_CLASS, "mt-1.5 max-w-[720px]")}>
                {project.description}
              </p>
            )}
            {progressSlot}
            {showMembers && (
              <div className="mt-5 flex items-center justify-between gap-4">
                {!project.isTemplate && (
                  <ProjectMembersDisplay
                    members={members}
                    isLoading={isLoading}
                    onMembersClick={() =>
                      membersHref && router.push(membersHref)
                    }
                    onAddMemberClick={
                      canManageMembers
                        ? () => setShowInviteDialog(true)
                        : undefined
                    }
                  />
                )}
                <div className="flex items-center gap-1 text-xs text-gray-550">
                  <Pencil aria-hidden className="size-3" />
                  <span>
                    Last modified{" "}
                    {project.updatedAt
                      ? formatDistanceToNow(new Date(project.updatedAt), {
                          addSuffix: true,
                        })
                      : "recently"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {extraActions}
          {canSubmitForReview && (
            <Button
              size="sm"
              variant="brand"
              className={HEADER_ACTION_BUTTON_CLASS}
              onClick={() => setShowSubmitDialog(true)}
            >
              <Send aria-hidden />
              Submit Application
            </Button>
          )}
          {headerActions !== undefined ? headerActions : defaultActions}
        </div>
      </div>

      {/* Invite Members Dialog */}
      {showMembers && (
        <InviteMembersDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          entityName={project.name}
          onSendInvitations={handleSendInvitations}
          isSubmitting={isSendingInvites}
          existingEmails={existingEmails}
          seatBillingActive={seatBillingActive}
        />
      )}

      {/* Create Template Dialog */}
      {!project.isTemplate && (
        <CreateTemplateDialog
          key={project.id}
          open={showTemplateDialog}
          onOpenChange={setShowTemplateDialog}
          project={project}
          onConfirm={handleCreateTemplate}
          isLoading={isCreatingTemplate}
        />
      )}

      {/* Edit Project Dialog */}
      {organizationSlug && officeSlug && (
        <EditProjectDialog
          project={project}
          organizationSlug={organizationSlug}
          officeSlug={officeSlug}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Submit Application Dialog */}
      {canSubmitForReview && organizationSlug && officeSlug && (
        <SubmitApplicationDialog
          projectId={project.id}
          projectName={project.name}
          organizationSlug={organizationSlug}
          officeSlug={officeSlug}
          preferredOrganizationId={project.intendedSubmissionOrganizationId}
          preferredOfficeId={project.intendedSubmissionOfficeId}
          open={showSubmitDialog}
          onOpenChange={setShowSubmitDialog}
        />
      )}
    </>
  );
}
