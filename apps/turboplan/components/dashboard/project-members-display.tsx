"use client";

import { UserPlus } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  Button,
  generateInitials,
} from "@wildfires-org/turboplan-utils";
import type { Member } from "@wildfires-org/turboplan-workspace/client";

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

  if (isLoading) {
    return (
      <div className="flex items-center gap-1">
        <div className="flex -space-x-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="size-8 rounded-full bg-muted animate-pulse border-2 border-background"
            />
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled
          className="size-7 rounded-md bg-gray-160 text-foreground hover:bg-gray-250"
        >
          <UserPlus className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {members.length > 0 ? (
        <div className="flex -space-x-2">
          {displayedMembers.map((member, index) => (
            <Avatar
              key={member.userId}
              className="size-8 cursor-pointer border-2 border-white transition-all hover:z-20"
              style={{ zIndex: displayedMembers.length - index }}
              title={member.user.email}
              onClick={onMembersClick}
            >
              <AvatarFallback className="bg-brandAlt-400 text-xs text-white">
                {getMemberInitials(member)}
              </AvatarFallback>
            </Avatar>
          ))}
          {remainingCount > 0 && (
            <div
              className="flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-brandAlt-400 transition-colors hover:bg-brandAlt-500"
              style={{ zIndex: 0 }}
              onClick={onMembersClick}
              title={`+${remainingCount} more members`}
            >
              <span className="text-xs font-medium text-white">
                +{remainingCount}
              </span>
            </div>
          )}
        </div>
      ) : null}

      {onAddMemberClick && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onAddMemberClick}
          className="size-7 rounded-md bg-brandAlt-400 text-white shadow-sm hover:bg-brandAlt-500 hover:text-white"
          title="Invite members"
        >
          <UserPlus className="size-4" />
        </Button>
      )}
    </div>
  );
}
