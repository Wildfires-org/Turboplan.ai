"use client";

import { Loader2 } from "lucide-react";

import {
  type Member,
  MemberListItem,
  SelectableMemberListItem,
} from "@wildfires-org/turboplan-workspace/client";

interface MembersListSectionProps {
  members: Member[];
  isLoading: boolean;
  isAssignMode: boolean;
  canManageMembers: boolean;
  currentUserId: string | undefined;
  selectedUserIds: Set<string>;
  onToggleUser: (userId: string) => void;
  onRoleChange: (userId: string, newRole: string) => void;
  onRemove: (userId: string) => void;
  isUpdating: boolean;
  isRemoving: boolean;
}

export const MembersListSection = ({
  members,
  isLoading,
  isAssignMode,
  canManageMembers,
  currentUserId,
  selectedUserIds,
  onToggleUser,
  onRoleChange,
  onRemove,
  isUpdating,
  isRemoving,
}: MembersListSectionProps) => {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-550">
        {isAssignMode
          ? `Select Members (${selectedUserIds.size} selected)`
          : `Members (${members.length})`}
      </h3>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No members yet.
          {canManageMembers &&
            (isAssignMode
              ? " Invite members to assign them."
              : " Add your first member above.")}
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto space-y-3">
          {isAssignMode
            ? members.map((member) => (
                <SelectableMemberListItem
                  key={member.userId}
                  member={member}
                  isSelected={selectedUserIds.has(member.userId)}
                  onToggle={onToggleUser}
                />
              ))
            : members.map((member) => (
                <MemberListItem
                  key={member.userId}
                  member={member}
                  onRoleChange={onRoleChange}
                  onRemove={onRemove}
                  canManage={canManageMembers}
                  currentUserId={currentUserId}
                  isUpdating={isUpdating}
                  isRemoving={isRemoving}
                />
              ))}
        </div>
      )}
    </div>
  );
};
