"use client";

import { Check, EllipsisVertical, Hourglass, Info, X } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  generateInitialsFromName,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@wildfires-org/turboplan-utils";

import type { MemberRoleType } from "../../types";
import type { MemberRow, MemberStatus, MembersTableConfig } from "./types";
import { getRoleDisplayName } from "./utils";

interface MemberRowItemProps {
  row: MemberRow;
  config: MembersTableConfig;
  onRoleChange?: (rowId: string, newRole: MemberRoleType) => void;
  onRemoveMember?: (userId: string) => void;
  onResendInvitation?: (invitationId: string) => void;
  onRevokeInvitation?: (invitationId: string) => void;
}

export function MemberRowItem({
  row,
  config,
  onRoleChange,
  onRemoveMember,
  onResendInvitation,
  onRevokeInvitation,
}: MemberRowItemProps) {
  return (
    <div className="flex items-center gap-4 border-t border-gray-200 px-6 py-3">
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <Avatar className="size-8 rounded-lg">
          {row.type === "invitation" ? (
            <AvatarFallback className="rounded-lg border border-dashed border-gray-300 bg-transparent text-xs">
              {generateInitialsFromName(row.name)}
            </AvatarFallback>
          ) : row.avatarUrl ? (
            <AvatarImage
              src={row.avatarUrl}
              alt={row.name}
              className="rounded-lg"
            />
          ) : (
            <AvatarFallback className="rounded-lg text-xs">
              {generateInitialsFromName(row.name)}
            </AvatarFallback>
          )}
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-900 truncate">{row.name}</p>
            {row.isCurrentUser && (
              <span className="text-[8px] font-semibold bg-gray-200 text-black rounded-md px-1.5 py-0.5 shrink-0">
                You
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 tracking-wide truncate">
            {row.type === "invitation" ? "pending invitation" : row.email}
          </p>
        </div>
      </div>

      {config.showSubEntityColumn && (
        <div className="w-[200px] flex gap-1.5 flex-wrap">
          {row.subEntities.map((entity) => (
            <span
              key={entity.id}
              className="bg-gray-100 text-gray-900 text-[10px] rounded px-1.5 py-0.5"
            >
              {entity.name}
            </span>
          ))}
        </div>
      )}

      <div className="w-[120px]">
        {config.canManageMembers && row.isDirect && !row.isCurrentUser ? (
          <Select
            value={row.role}
            onValueChange={(v) => onRoleChange?.(row.id, v as MemberRoleType)}
          >
            <SelectTrigger className="h-9 w-[104px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-foreground">
              {getRoleDisplayName(row.role)}
            </span>
            {!row.isDirect && row.inheritedFrom && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px]">
                    <p className="text-xs">
                      This role is inherited from {row.inheritedFrom}. To change
                      it, update the role there or assign a direct role via
                      Invite Members.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>

      <div className="w-[100px]">
        <StatusIcon status={row.status} />
      </div>

      {config.canManageMembers && (
        <div className="w-[60px] flex justify-end">
          {(row.type === "invitation" ||
            (row.isDirect && !row.isCurrentUser)) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0 rounded-full"
                >
                  <EllipsisVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {row.type === "invitation" ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => onResendInvitation?.(row.invitationId)}
                    >
                      Resend invitation
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onRevokeInvitation?.(row.invitationId)}
                    >
                      Revoke invitation
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onRemoveMember?.(row.id)}
                  >
                    Remove member
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: MemberStatus }) {
  switch (status) {
    case "active":
      return <Check className="size-4 text-green-500" />;
    case "inactive":
      return <X className="size-4 text-red-500" />;
    case "pending":
      return <Hourglass className="size-4 text-gray-400" />;
  }
}
