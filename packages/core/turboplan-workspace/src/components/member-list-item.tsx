"use client";

import { Trash2 } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  Button,
  generateDisplayName,
  generateInitials,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wildfires-org/turboplan-utils";

import type { Member } from "../hooks/use-member-management";
import { EntityType, type InheritanceInfo, MemberRole } from "../types";

interface MemberListItemProps {
  member: Member & { inheritance?: InheritanceInfo };
  onRoleChange: (userId: string, newRole: string) => void;
  onRemove: (userId: string) => void;
  canManage: boolean;
  currentUserId?: string;
  isUpdating?: boolean;
  isRemoving?: boolean;
}

/**
 * List item component for displaying and managing individual members
 *
 * Shows member avatar, name/email, and role with conditional edit controls
 * based on permissions.
 *
 * @example
 * ```tsx
 * <MemberListItem
 *   member={member}
 *   onRoleChange={(userId, newRole) => updateRole({ userId, role: newRole })}
 *   onRemove={(userId) => removeMember({ userId })}
 *   canManage={hasManagePermission}
 *   isUpdating={isUpdating}
 *   isRemoving={isRemoving}
 * />
 * ```
 */
export function MemberListItem({
  member,
  onRoleChange,
  onRemove,
  canManage,
  currentUserId,
  isUpdating = false,
  isRemoving = false,
}: MemberListItemProps) {
  const userLike = {
    firstName: member.profile?.firstName,
    lastName: member.profile?.lastName,
    email: member.user.email,
  };

  const getInheritanceLabel = () => {
    if (!member.inheritance || member.inheritance.isDirect) {
      return null;
    }

    const { inheritedFrom } = member.inheritance;
    if (!inheritedFrom) return null;

    const entityTypeLabel =
      inheritedFrom.entityType === EntityType.ORGANIZATION
        ? "Organization"
        : "Office";

    return `${entityTypeLabel}: ${inheritedFrom.entityName || inheritedFrom.entityId}`;
  };

  const isInherited = member.inheritance && !member.inheritance.isDirect;
  const inheritanceLabel = getInheritanceLabel();
  const isCurrentUser = currentUserId && member.userId === currentUserId;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl p-3 ring-1 ring-inset ${
        isInherited
          ? "bg-brandAlt-100/60 ring-brandAlt-200/60"
          : "bg-white ring-slate-900/[0.06] dark:bg-white/5 dark:ring-white/10"
      }`}
    >
      <Avatar>
        <AvatarFallback>{generateInitials(userLike)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {isCurrentUser && (
              <>
                <span className="inline-block font-bold ml-1">You</span>
                {" - "}
              </>
            )}
            {generateDisplayName(userLike)}
          </p>
          {isInherited && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
              Inherited
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {member.user.email}
        </p>
        {isInherited && inheritanceLabel && (
          <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
            From {inheritanceLabel}
          </p>
        )}
      </div>

      {canManage && !isInherited ? (
        <>
          <Select
            value={member.role}
            onValueChange={(value) => onRoleChange(member.userId, value)}
            disabled={isUpdating}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MemberRole.OWNER}>Owner</SelectItem>
              <SelectItem value={MemberRole.EDITOR}>Editor</SelectItem>
              <SelectItem value={MemberRole.VIEWER}>Viewer</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(member.userId)}
            disabled={isRemoving}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </>
      ) : (
        <div className="text-sm text-muted-foreground capitalize">
          {member.role}
        </div>
      )}
    </div>
  );
}
