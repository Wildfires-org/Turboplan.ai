"use client";

import type { User } from "next-auth";

import { EntityType } from "@wildfires-org/turboplan-rbac";
import {
  InviteMembersDialog,
  MembersTable,
} from "@wildfires-org/turboplan-workspace/client";
import type { Organization } from "@wildfires-org/turboplan-workspace/types";

import { OrgTabNav } from "@/components/dashboard/org-tab-nav";
import { useMembersSection } from "@/hooks/use-members-section";
import { useOrgBillingActive } from "@/hooks/use-org-billing-active";
import { STICKY_TOOLBAR_CLASS } from "@/lib/glass";

interface OrgMembersSectionProps {
  user: User;
  organization: Organization;
  orgSlug: string;
}

export function OrgMembersSection({
  user,
  organization,
  orgSlug,
}: OrgMembersSectionProps) {
  const {
    rows,
    existingEmails,
    config,
    searchQuery,
    setSearchQuery,
    isLoading,
    showInviteForm,
    isSendingInvites,
    handleSendInvitations,
    handleInviteDialogChange,
    handleRoleChange,
    handleRemoveMember,
    handleResendInvitation,
    handleRevokeInvitation,
  } = useMembersSection({
    user,
    entityType: EntityType.ORGANIZATION,
    entityId: organization.id,
    subEntityLabel: "Offices",
  });

  const seatBillingActive = useOrgBillingActive(organization.id);

  return (
    <div className="space-y-2">
      <InviteMembersDialog
        open={showInviteForm}
        onOpenChange={handleInviteDialogChange}
        entityName={organization.name}
        onSendInvitations={handleSendInvitations}
        isSubmitting={isSendingInvites}
        existingEmails={existingEmails}
        seatBillingActive={seatBillingActive}
      />
      <div className={STICKY_TOOLBAR_CLASS}>
        <OrgTabNav
          orgSlug={orgSlug}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search members..."
        />
      </div>
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
  );
}
