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

  // Picks go straight into the pending list with the current default role —
  // there is no separate "Assign" step.
  const addInvitees = useCallback(
    (users: SelectedUserValue[]) => {
      setPendingInvitees((prev) => {
        const pendingEmails = new Set(
          prev.map((invitee) => invitee.email.toLowerCase()),
        );
        const newInvitees = users
          .filter((user) => !pendingEmails.has(user.email.toLowerCase()))
          .map((user) => toPendingInvitee(user, currentRole));

        return [...prev, ...newInvitees];
      });
    },
    [currentRole],
  );

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
    setCurrentRole(MemberRole.VIEWER);
  }, []);

  return {
    addInvitees,
    currentRole,
    excludedEmails,
    handleRemove,
    handleRoleChange,
    pendingInvitees,
    resetInvitations,
    setCurrentRole,
  };
}
