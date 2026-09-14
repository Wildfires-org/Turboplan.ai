"use client";

import { useCallback, useMemo, useState } from "react";

import { generateDisplayName } from "@wildfires-org/turboplan-utils";

import type { PendingInvitee } from "../components/invite-members-dialog";
import {
  isInviteUser,
  type SelectedUserValue,
} from "../components/user-selector";
import { MemberRole, type MemberRoleType } from "../types";

function toPendingInvitee(
  user: SelectedUserValue,
  role: MemberRoleType,
): PendingInvitee {
  if (isInviteUser(user)) {
    return {
      id: `invite-${user.email}`,
      email: user.email,
      displayName: user.email,
      avatarUrl: null,
      role,
      isInvite: true,
    };
  }

  return {
    id: user.id,
    email: user.email,
    displayName: generateDisplayName(user),
    avatarUrl: user.avatarUrl,
    role,
    isInvite: false,
  };
}

interface UseMemberInvitationOptions {
  existingEmails?: Set<string>;
}

export function useMemberInvitation({
  existingEmails,
}: UseMemberInvitationOptions = {}) {
  const [pendingInvitees, setPendingInvitees] = useState<PendingInvitee[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SelectedUserValue[]>([]);
  const [currentRole, setCurrentRole] = useState<MemberRoleType>(
    MemberRole.VIEWER,
  );

  const excludedEmails = useMemo(() => {
    const emails = new Set(existingEmails);
    for (const invitee of pendingInvitees) {
      emails.add(invitee.email.toLowerCase());
    }
    return emails;
  }, [existingEmails, pendingInvitees]);

  const handleAssign = useCallback(() => {
    if (selectedUsers.length === 0) return;

    setPendingInvitees((prev) => {
      const existingEmails = new Set(
        prev.map((invitee) => invitee.email.toLowerCase()),
      );
      const newInvitees = selectedUsers
        .filter((user) => !existingEmails.has(user.email.toLowerCase()))
        .map((user) => toPendingInvitee(user, currentRole));

      return [...prev, ...newInvitees];
    });
    setSelectedUsers([]);
  }, [currentRole, selectedUsers]);

  const handleRoleChange = useCallback((id: string, role: MemberRoleType) => {
    setPendingInvitees((prev) =>
      prev.map((invitee) =>
        invitee.id === id ? { ...invitee, role } : invitee,
      ),
    );
  }, []);

  const handleRemove = useCallback((id: string) => {
    setPendingInvitees((prev) => prev.filter((invitee) => invitee.id !== id));
  }, []);

  const resetInvitations = useCallback(() => {
    setPendingInvitees([]);
    setSelectedUsers([]);
    setCurrentRole(MemberRole.VIEWER);
  }, []);

  return {
    currentRole,
    excludedEmails,
    handleAssign,
    handleRemove,
    handleRoleChange,
    pendingInvitees,
    resetInvitations,
    selectedUsers,
    setCurrentRole,
    setSelectedUsers,
  };
}
