"use client";

import { useCallback } from "react";

import useSWR, { type KeyedMutator } from "swr";
import useSWRMutation from "swr/mutation";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";
import type { TaskAssignment } from "@wildfires-org/turboplan-db";
import { useInvalidateEntityActions } from "@wildfires-org/turboplan-rbac/hooks";

import {
  EntityType,
  type EntityTypeType,
  type PendingInvitation,
} from "../types";

const apiClient = new ApiClient();

export type { PendingInvitation };

export interface Member {
  userId: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
  };
  profile: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  } | null;
}

export interface MembersResponse {
  members: Member[];
  pendingInvitations: PendingInvitation[];
}

interface MemberManagementConfig {
  entityType: EntityTypeType;
  entityId: string;
  enabled?: boolean;
}

async function addMemberFetcher(
  url: string,
  {
    arg,
  }: { arg: { email: string; role: string; taskAssignment?: TaskAssignment } },
) {
  const { data, error } = await apiClient.post(url, arg);

  if (error) {
    throw new Error(error || "Failed to add member");
  }

  return data;
}

async function updateMemberFetcher(
  url: string,
  { arg }: { arg: { userId: string; role: string } },
) {
  const { data, error } = await apiClient.patch(url, arg);

  if (error) {
    throw new Error(error || "Failed to update role");
  }

  return data;
}

async function removeMemberFetcher(
  url: string,
  { arg }: { arg: { userId: string } },
) {
  const { data, error } = await apiClient.delete(`${url}?userId=${arg.userId}`);

  if (error) {
    throw new Error(error || "Failed to remove member");
  }

  return data;
}

async function resendInvitationFetcher(
  _url: string,
  { arg }: { arg: { invitationId: string } },
) {
  const { data, error } = await apiClient.post(
    `/api/invitations/${arg.invitationId}/resend`,
    {},
  );

  if (error) {
    throw new Error(error || "Failed to resend invitation");
  }

  return data;
}

async function revokeInvitationFetcher(
  _url: string,
  { arg }: { arg: { invitationId: string } },
) {
  const { data, error } = await apiClient.delete(
    `/api/invitations/${arg.invitationId}`,
  );

  if (error) {
    throw new Error(error || "Failed to revoke invitation");
  }

  return data;
}

/**
 * Generic hook for managing members across different entity types (organization, office, project)
 *
 * Handles fetching, adding, updating, and removing members with proper API routing
 * based on entity type.
 *
 * @example
 * ```tsx
 * const { members, addMember, updateMemberRole, removeMember, isLoading } =
 *   useMemberManagement({
 *     entityType: EntityType.ORGANIZATION,
 *     entityId: orgId,
 *     enabled: isDialogOpen,
 *   });
 *
 * // Add a member
 * await addMember({ email: 'user@example.com', role: 'editor' });
 *
 * // Update role
 * await updateMemberRole({ userId: '123', role: 'owner' });
 *
 * // Remove member
 * await removeMember({ userId: '123' });
 * ```
 *
 * @param config - Configuration object with entity details
 * @returns Object with members array, loading states, and mutation functions
 */
export function useMemberManagement({
  entityType,
  entityId,
  enabled = true,
}: MemberManagementConfig) {
  // Construct API endpoint based on entity type
  const getApiPath = () => {
    switch (entityType) {
      case EntityType.ORGANIZATION:
        return `/api/organizations/${entityId}/members`;
      case EntityType.OFFICE:
        return `/api/offices/${entityId}/members`;
      case EntityType.PROJECT:
        return `/api/projects/${entityId}/members`;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  };

  const apiPath = getApiPath();

  // Fetch members and pending invitations
  const {
    data: membersData,
    isLoading,
    error,
    mutate: mutateMembers,
  } = useSWR<MembersResponse>(enabled ? apiPath : null, fetcher);

  // Membership changes are the only thing that alters what `useEntityPermission`
  // reports, and that hook never revalidates a cached entry on its own — so
  // every refresh of the member list also drops the cached permission entries.
  //
  // Forwards every argument SWR's mutator accepts (optimistic data, options),
  // so callers are not silently limited to the zero-arg form.
  const invalidateEntityActions = useInvalidateEntityActions();
  const mutate = useCallback(
    (...args: Parameters<KeyedMutator<MembersResponse>>) => {
      const result = mutateMembers(...args);
      invalidateEntityActions();
      return result;
    },
    [mutateMembers, invalidateEntityActions],
  );

  // Mutations
  const { trigger: addMember, isMutating: isAdding } = useSWRMutation(
    apiPath,
    addMemberFetcher,
  );

  const { trigger: updateMemberRole, isMutating: isUpdating } = useSWRMutation(
    apiPath,
    updateMemberFetcher,
  );

  const { trigger: removeMember, isMutating: isRemoving } = useSWRMutation(
    apiPath,
    removeMemberFetcher,
  );

  // Invitation mutations (use a stable key since the actual endpoint is constructed in the fetcher)
  const { trigger: resendInvitation, isMutating: isResending } = useSWRMutation(
    `invitations-resend-${entityId}`,
    resendInvitationFetcher,
  );

  const { trigger: revokeInvitation, isMutating: isRevoking } = useSWRMutation(
    `invitations-revoke-${entityId}`,
    revokeInvitationFetcher,
  );

  const members = membersData?.members || [];
  const pendingInvitations = membersData?.pendingInvitations || [];

  return {
    members,
    pendingInvitations,
    isLoading,
    error,
    mutate,
    addMember,
    isAdding,
    updateMemberRole,
    isUpdating,
    removeMember,
    isRemoving,
    resendInvitation,
    isResending,
    revokeInvitation,
    isRevoking,
  };
}
