"use client";

import { ChevronDown, X } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  generateInitialsFromName,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wildfires-org/turboplan-utils";

import { MemberRole, type MemberRoleType } from "../../types";
import { getRoleDisplayName } from "../members-table/utils";
import type { PendingInvitee } from "./types";

interface PendingInviteeRowProps {
  invitee: PendingInvitee;
  onRoleChange: (id: string, role: MemberRoleType) => void;
  onRemove: (id: string) => void;
}

export function PendingInviteeRow({
  invitee,
  onRoleChange,
  onRemove,
}: PendingInviteeRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <Avatar className="size-6 shrink-0 text-xs">
          <AvatarImage src={invitee.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-[10px]">
            {generateInitialsFromName(invitee.displayName)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate text-sm text-foreground">
          {invitee.displayName}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Select
          value={invitee.role}
          onValueChange={(value) =>
            onRoleChange(invitee.id, value as MemberRoleType)
          }
        >
          <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full px-3 text-sm">
            <SelectValue />
            <ChevronDown className="size-3.5 opacity-50" />
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

        <button
          type="button"
          onClick={() => onRemove(invitee.id)}
          aria-label={`Remove ${invitee.displayName}`}
          className="rounded-full p-1 text-gray-550 transition-colors hover:bg-brandAlt-100 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
