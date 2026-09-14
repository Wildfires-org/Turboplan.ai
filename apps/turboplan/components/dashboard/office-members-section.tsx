"use client";

import type { User } from "next-auth";

import { EntityType } from "@wildfires-org/turboplan-rbac";
import {
  InviteMembersDialog,
  MembersTable,
} from "@wildfires-org/turboplan-workspace/client";
import type { Office } from "@wildfires-org/turboplan-workspace/types";

import { OfficeTabNav } from "@/components/dashboard/office-tab-nav";
import { useMembersSection } from "@/hooks/use-members-section";
import { useOrgBillingActive } from "@/hooks/use-org-billing-active";

interface OfficeMembersSectionProps {
  user: User;
  office: Office;
  orgSlug: string;
  officeSlug: string;
}

export function OfficeMembersSection({
  user,
  office,
  orgSlug,
  officeSlug,
}: OfficeMembersSectionProps) {
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
    entityType: EntityType.OFFICE,
    entityId: office.id,
    subEntityLabel: "Projects",
  });

  // The subscription lives on the owning organization, which the office object
  // carries directly via `organizationId`.
  const seatBillingActive = useOrgBillingActive(office.organizationId);

  return (
    <div className="space-y-2">
      <InviteMembersDialog
        open={showInviteForm}
        onOpenChange={handleInviteDialogChange}
        entityName={office.name}
        onSendInvitations={handleSendInvitations}
        isSubmitting={isSendingInvites}
        existingEmails={existingEmails}
        seatBillingActive={seatBillingActive}
      />
      <div className="sticky top-[120px] z-20 -mx-6 bg-[#F9FAFB] px-6 pb-2 pt-4">
        <OfficeTabNav
          orgSlug={orgSlug}
          officeSlug={officeSlug}
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
