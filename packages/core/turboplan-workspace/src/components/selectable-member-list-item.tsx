"use client";

import {
  Avatar,
  AvatarFallback,
  generateDisplayName,
  generateInitials,
} from "@wildfires-org/turboplan-utils";

import type { Member } from "../hooks/use-member-management";

interface SelectableMemberListItemProps {
  member: Member;
  isSelected: boolean;
  onToggle: (userId: string) => void;
}

/**
 * Member list item with checkbox for selection (used in assignment mode)
 */
export function SelectableMemberListItem({
  member,
  isSelected,
  onToggle,
}: SelectableMemberListItemProps) {
  const userLike = {
    firstName: member.profile?.firstName,
    lastName: member.profile?.lastName,
    email: member.user.email,
  };

  return (
    <label
      className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-inset ring-slate-900/[0.06] transition-colors hover:bg-brandAlt-100 dark:bg-white/5 dark:ring-white/10"
      onClick={(e) => {
        e.preventDefault();
        onToggle(member.userId);
      }}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggle(member.userId)}
        onClick={(e) => e.stopPropagation()}
        className="size-4 rounded border-gray-300 dark:border-gray-600 text-brand-800 focus:ring-brand-700"
      />

      <Avatar>
        <AvatarFallback>{generateInitials(userLike)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {generateDisplayName(userLike)}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {member.user.email}
        </p>
      </div>

      <div className="text-xs text-muted-foreground capitalize">
        {member.role}
      </div>
    </label>
  );
}
