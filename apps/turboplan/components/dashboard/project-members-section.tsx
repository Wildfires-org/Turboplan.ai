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
    <div>
      <InviteMembersDialog
        open={showInviteForm}
        onOpenChange={handleInviteDialogChange}
        entityName={project.name}
        onSendInvitations={handleSendInvitations}
        isSubmitting={isSendingInvites}
        existingEmails={existingEmails}
        seatBillingActive={seatBillingActive}
      />
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <ProjectSubpageHeader
          title="Members List"
          backHref={backHref}
          noBorder
        />
        <div className="flex items-center gap-3">
          {canManageMembers && (
            <Button
              size="sm"
              className="gap-2 rounded-[6px] bg-foreground px-4 py-1.5 text-[14px] font-medium leading-[20px] text-white hover:bg-foreground/90"
              onClick={openInviteForm}
            >
              <UserPlus className="size-5" />
              Invite Members
            </Button>
          )}
          <div className="flex items-center gap-1.5 rounded-md border border-gray-200 p-2">
            <Search className="size-4 text-gray-400" />
            <input
              type="text"
              aria-label="Search members"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="w-[280px] bg-transparent text-xs tracking-[0.12px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
          </div>
        </div>
      </div>
      <div className="pt-6">
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
