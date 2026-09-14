"use client";

import { useCallback, useMemo, useState } from "react";

import type { User } from "next-auth";

import {
  Action,
  EntityType,
  type EntityTypeType,
} from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import { toast } from "@wildfires-org/turboplan-utils";
import {
  type MemberRow,
  type MembersTableConfig,
  type PendingInvitee,
  useMemberManagement,
} from "@wildfires-org/turboplan-workspace/client";
import type {
  MemberRoleType,
  MemberWithInheritance,
  PendingInvitation,
} from "@wildfires-org/turboplan-workspace/types";

import { useInviteMembers } from "@/components/dashboard/invite-members-context";
import { useSendInvitations } from "@/hooks/use-send-invitations";

const hasInheritanceData = (m: unknown): m is MemberWithInheritance =>
  typeof m === "object" && m !== null && "inheritance" in m;

interface UseMembersSectionOptions {
  user: User;
  entityType: EntityTypeType;
  entityId: string;
  /** Label for the sub-entity column (e.g. "Offices", "Projects", "Tasks") */
  subEntityLabel: string;
}

interface UseMembersSectionResult {
  rows: MemberRow[];
  existingEmails: Set<string>;
  config: MembersTableConfig;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  canManageMembers: boolean;
  isLoading: boolean;
  showInviteForm: boolean;
  openInviteForm: () => void;
  isSendingInvites: boolean;
  handleSendInvitations: (invitees: PendingInvitee[]) => Promise<void>;
  handleRoleChange: (rowId: string, newRole: MemberRoleType) => Promise<void>;
  handleRemoveMember: (userId: string) => Promise<void>;
  handleResendInvitation: (invitationId: string) => Promise<void>;
  handleRevokeInvitation: (invitationId: string) => Promise<void>;
  handleInviteDialogChange: (open: boolean) => void;
}

const transformMemberWithInheritance = (
  member: MemberWithInheritance,
  currentUserId: string,
): MemberRow => ({
  id: member.userId,
  type: "member",
  name:
    [member.profile?.firstName, member.profile?.lastName]
      .filter(Boolean)
      .join(" ") || member.user.email,
  email: member.user.email,
  avatarUrl: member.profile?.avatarUrl ?? null,
  role: member.role as MemberRoleType,
  status: "active",
  isCurrentUser: member.userId === currentUserId,
  isDirect: member.inheritance.isDirect,
  inheritedFrom: member.inheritance.inheritedFrom?.entityName,
  subEntities: [],
});

const transformDirectMember = (
  member: {
    userId: string;
    role: string;
    user: { email: string };
    profile?: {
      firstName?: string | null;
      lastName?: string | null;
      avatarUrl?: string | null;
    } | null;
  },
  currentUserId: string,
): MemberRow => ({
  id: member.userId,
  type: "member",
  name:
    [member.profile?.firstName, member.profile?.lastName]
      .filter(Boolean)
      .join(" ") || member.user.email,
  email: member.user.email,
  avatarUrl: member.profile?.avatarUrl ?? null,
  role: member.role as MemberRoleType,
  status: "active",
  isCurrentUser: member.userId === currentUserId,
  isDirect: true,
  subEntities: [],
});

const transformInvitation = (inv: PendingInvitation): MemberRow => ({
  id: `inv-${inv.id}`,
  type: "invitation",
  name: inv.email.split("@")[0],
  email: inv.email,
  avatarUrl: null,
  role: inv.role as MemberRoleType,
  status: "pending",
  isCurrentUser: false,
  isDirect: true,
  subEntities: [],
  invitationId: inv.id,
});

export function useMembersSection({
  user,
  entityType,
  entityId,
  subEntityLabel,
}: UseMembersSectionOptions): UseMembersSectionResult {
  const { showInviteForm, openInviteForm, closeInviteForm } =
    useInviteMembers();
  const [searchQuery, setSearchQuery] = useState("");

  const {
    members,
    pendingInvitations,
    isLoading,
    mutate,
    addMember,
    updateMemberRole,
    removeMember,
    resendInvitation,
    revokeInvitation,
  } = useMemberManagement({
    entityType,
    entityId,
  });

  const { hasPermission: canManageMembers } = useEntityPermission({
    userId: user.id,
    entityType,
    entityId,
    action: Action.MANAGE_MEMBERS,
  });

  const userId = user.id ?? "";

  const rows = useMemo<MemberRow[]>(
    () => [
      ...members.map((m) =>
        hasInheritanceData(m)
          ? transformMemberWithInheritance(m, userId)
          : transformDirectMember(m, userId),
      ),
      ...pendingInvitations.map(transformInvitation),
    ],
    [members, pendingInvitations, userId],
  );

  const existingEmails = useMemo(
    () =>
      new Set([
        ...members
          .filter((m) => {
            const inherited = hasInheritanceData(m);
            return inherited ? m.inheritance.isDirect : true;
          })
          .map((m) => m.user.email.toLowerCase()),
        ...pendingInvitations.map((inv) => inv.email.toLowerCase()),
      ]),
    [members, pendingInvitations],
  );

  const config: MembersTableConfig = {
    subEntityLabel,
    showSubEntityColumn: false,
    showSubEntityFilter: false,
    canManageMembers,
    showAccessFilter: entityType !== EntityType.ORGANIZATION,
  };

  const { handleSendInvitations, isSending: isSendingInvites } =
    useSendInvitations({
      addMember,
      onSuccess: () => {
        mutate();
        closeInviteForm();
      },
    });

  const handleRoleChange = useCallback(
    async (rowId: string, newRole: MemberRoleType) => {
      try {
        await updateMemberRole({ userId: rowId, role: newRole });
        mutate();
      } catch {
        toast({ type: "error", description: "Failed to update role." });
      }
    },
    [updateMemberRole, mutate],
  );

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      try {
        await removeMember({ userId });
        mutate();
      } catch {
        toast({ type: "error", description: "Failed to remove member." });
      }
    },
    [removeMember, mutate],
  );

  const handleResendInvitation = useCallback(
    async (invitationId: string) => {
      try {
        await resendInvitation({ invitationId });
        mutate();
        toast({ type: "success", description: "Invitation resent." });
      } catch {
        toast({
          type: "error",
          description: "Failed to resend invitation.",
        });
      }
    },
    [resendInvitation, mutate],
  );

  const handleRevokeInvitation = useCallback(
    async (invitationId: string) => {
      try {
        await revokeInvitation({ invitationId });
        mutate();
        toast({ type: "success", description: "Invitation revoked." });
      } catch {
        toast({
          type: "error",
          description: "Failed to revoke invitation.",
        });
      }
    },
    [revokeInvitation, mutate],
  );

  const handleInviteDialogChange = useCallback(
    (open: boolean) => {
      if (!open) closeInviteForm();
    },
    [closeInviteForm],
  );

  return {
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
    handleRoleChange,
    handleRemoveMember,
    handleResendInvitation,
    handleRevokeInvitation,
    handleInviteDialogChange,
  };
}
