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
      className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
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
        className="size-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
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
