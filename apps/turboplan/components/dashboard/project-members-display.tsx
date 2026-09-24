"use client";

import { UserPlus } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  generateInitials,
} from "@wildfires-org/turboplan-utils";
import type { Member } from "@wildfires-org/turboplan-workspace/client";

import { GLASS_ICON_BUTTON_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

interface ProjectMembersDisplayProps {
  members: Member[];
  isLoading?: boolean;
  onMembersClick: () => void;
  onAddMemberClick?: () => void;
}

export function ProjectMembersDisplay({
  members,
  isLoading = false,
  onMembersClick,
  onAddMemberClick,
}: ProjectMembersDisplayProps) {
  const getMemberInitials = (member: Member) => {
    return generateInitials({
      firstName: member.profile?.firstName,
      lastName: member.profile?.lastName,
      email: member.user.email,
    });
  };

  // Show up to 3 members, then show a "+N" indicator
  const displayedMembers = members.slice(0, 3);
  const remainingCount = Math.max(0, members.length - 3);

  const inviteButton = onAddMemberClick && (
    <button
      type="button"
      onClick={onAddMemberClick}
      aria-label="Invite members"
      title="Invite members"
      className={cn(GLASS_ICON_BUTTON_CLASS, "size-8 text-brand-800")}
    >
      <UserPlus aria-hidden className="size-4" />
    </button>
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5">
        <div aria-hidden className="flex -space-x-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="size-8 animate-pulse rounded-full border-2 border-white bg-brandAlt-200 motion-reduce:animate-none"
            />
          ))}
        </div>
        {inviteButton}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {members.length > 0 ? (
        <button
          type="button"
          onClick={onMembersClick}
          aria-label={`View all ${members.length} members`}
          className="press flex -space-x-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          {displayedMembers.map((member, index) => (
            <Avatar
              key={member.userId}
              className="size-8 border-2 border-white"
              style={{ zIndex: displayedMembers.length - index }}
              title={member.user.email}
            >
              {/* brand-800: white initials >= 4.5:1 */}
              <AvatarFallback className="bg-brand-800 text-xs font-medium text-white">
                {getMemberInitials(member)}
              </AvatarFallback>
            </Avatar>
          ))}
          {remainingCount > 0 && (
            <span
              className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-brand-900 text-xs font-medium text-white"
              style={{ zIndex: 0 }}
              title={`+${remainingCount} more members`}
            >
              +{remainingCount}
            </span>
          )}
        </button>
      ) : null}

      {inviteButton}
    </div>
  );
}
