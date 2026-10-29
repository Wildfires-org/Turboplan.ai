"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wildfires-org/turboplan-utils";

import type { UserSearchScope } from "../hooks/use-user-search";
import { MemberRole, type MemberRoleType } from "../types";
import { getRoleDisplayName } from "./members-table/utils";
import { type SelectedUserValue, UserSelector } from "./user-selector";

interface MemberAssignRowProps {
  /**
   * Called with the picked user (or "invite" email) the moment it is chosen,
   * so the consumer can add it to its pending list with `currentRole`. Nothing
   * stays staged in the input; it clears for the next pick.
   */
  onAdd: (users: SelectedUserValue[]) => void;
  /** Entity the user search runs for (see UserSelector) */
  searchScope: UserSearchScope;
  currentRole: MemberRoleType;
  onRoleChange: (role: MemberRoleType) => void;
  disabled?: boolean;
  excludeEmails?: Set<string>;
}

// The selector never holds chips: with an empty value its onChange receives
// exactly the newly picked item. Module-level so the reference stays stable.
const NO_SELECTION: SelectedUserValue[] = [];

export function MemberAssignRow({
  onAdd,
  searchScope,
  currentRole,
  onRoleChange,
  disabled = false,
  excludeEmails,
}: MemberAssignRowProps) {
  return (
    <div className="relative">
      <UserSelector
        value={NO_SELECTION}
        onChange={onAdd}
        searchScope={searchScope}
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
  );
}
