"use client";

import { Search, UserPlus } from "lucide-react";
import type { User } from "next-auth";

import { EntityType } from "@wildfires-org/turboplan-rbac";
import { Button } from "@wildfires-org/turboplan-utils";
import {
  InviteMembersDialog,
  MembersTable,
} from "@wildfires-org/turboplan-workspace/client";
import type { Project } from "@wildfires-org/turboplan-workspace/types";

import { ProjectSubpageHeader } from "@/components/dashboard/project-subpage-header";
import { useMembersSection } from "@/hooks/use-members-section";
import { useOrgBillingActive } from "@/hooks/use-org-billing-active";
import {
  HEADER_ACTION_BUTTON_CLASS,
  SEARCH_FIELD_CLASS,
  SEARCH_INPUT_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

interface ProjectMembersSectionProps {
  user: User;
  project: Project;
  /** Owning organization id — the seat subscription lives on the org. */
  organizationId: string;
  backHref: string;
}

export function ProjectMembersSection({
  user,
  project,
  organizationId,
  backHref,
}: ProjectMembersSectionProps) {
  const {
    rows,
    existingEmails,
    config,
    searchQuery,
    setSearchQuery,
    canManageMembers,
    isLoading,
    showInviteForm,
    openInviteForm,
    isSendingInvites,
    handleSendInvitations,
    handleInviteDialogChange,
    handleRoleChange,
    handleRemoveMember,
    handleResendInvitation,
    handleRevokeInvitation,
  } = useMembersSection({
    user,
    entityType: EntityType.PROJECT,
    entityId: project.id,
    subEntityLabel: "Tasks",
  });

  const seatBillingActive = useOrgBillingActive(organizationId);

  return (
    <div className="space-y-6">
      <InviteMembersDialog
        open={showInviteForm}
        onOpenChange={handleInviteDialogChange}
        entityName={project.name}
        onSendInvitations={handleSendInvitations}
        isSubmitting={isSendingInvites}
        existingEmails={existingEmails}
        seatBillingActive={seatBillingActive}
      />
      <ProjectSubpageHeader
        title="Members"
        backHref={backHref}
        actions={
          <>
            <label className={cn(SEARCH_FIELD_CLASS, "sm:w-[280px]")}>
              <Search aria-hidden className="size-4 shrink-0 text-gray-550" />
              <input
                type="text"
                aria-label="Search members"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search members..."
                className={SEARCH_INPUT_CLASS}
              />
            </label>
            {canManageMembers && (
              <Button
                size="sm"
                variant="brand"
                className={cn(HEADER_ACTION_BUTTON_CLASS, "h-10 shrink-0")}
                onClick={openInviteForm}
              >
                <UserPlus aria-hidden />
                Invite Members
              </Button>
            )}
          </>
        }
      />
      <div>
        <MembersTable
          rows={rows}
          config={config}
          searchQuery={searchQuery}
          onRoleChange={handleRoleChange}
          onRemoveMember={handleRemoveMember}
          onResendInvitation={handleResendInvitation}
          onRevokeInvitation={handleRevokeInvitation}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
