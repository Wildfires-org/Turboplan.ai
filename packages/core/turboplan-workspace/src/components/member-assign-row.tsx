"use client";

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wildfires-org/turboplan-utils";

import { MemberRole, type MemberRoleType } from "../types";
import { getRoleDisplayName } from "./members-table/utils";
import { type SelectedUserValue, UserSelector } from "./user-selector";

interface MemberAssignRowProps {
  selectedUsers: SelectedUserValue[];
  onSelectedUsersChange: (users: SelectedUserValue[]) => void;
  currentRole: MemberRoleType;
  onRoleChange: (role: MemberRoleType) => void;
  onAssign: () => void;
  disabled?: boolean;
  excludeEmails?: Set<string>;
}

export function MemberAssignRow({
  selectedUsers,
  onSelectedUsersChange,
  currentRole,
  onRoleChange,
  onAssign,
  disabled = false,
  excludeEmails,
}: MemberAssignRowProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative min-w-0 flex-1">
        <UserSelector
          value={selectedUsers}
          onChange={onSelectedUsersChange}
          placeholder="Name or email"
          allowInvite
          disabled={disabled}
          excludeEmails={excludeEmails}
        />
        <div className="absolute inset-y-1 right-1 z-10 flex items-center rounded-lg bg-brandAlt-100">
          <Select
            value={currentRole}
            onValueChange={(v) => onRoleChange(v as MemberRoleType)}
            disabled={disabled}
          >
            <SelectTrigger className="size-auto h-full gap-1 border-0 bg-transparent p-0 px-2 text-sm text-gray-950 shadow-none focus:ring-0 focus:ring-offset-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MemberRole.OWNER}>
                {getRoleDisplayName("owner")}
              </SelectItem>
              <SelectItem value={MemberRole.EDITOR}>
                {getRoleDisplayName("editor")}
              </SelectItem>
              <SelectItem value={MemberRole.VIEWER}>
                {getRoleDisplayName("viewer")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        type="button"
        variant="glass"
        className="h-10 shrink-0 px-6"
        disabled={selectedUsers.length === 0 || disabled}
        onClick={onAssign}
      >
        Assign
      </Button>
    </div>
  );
}
