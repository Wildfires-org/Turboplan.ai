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
    <div className="flex items-center gap-4 border-t border-slate-900/[0.06] px-6 py-3 first:border-t-0 dark:border-white/10">
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <Avatar className="size-8 rounded-lg">
          {row.type === "invitation" ? (
            <AvatarFallback className="rounded-lg border border-dashed border-brandAlt-300 bg-transparent text-xs text-brand-900">
              {generateInitialsFromName(row.name)}
            </AvatarFallback>
          ) : row.avatarUrl ? (
            <AvatarImage
              src={row.avatarUrl}
              alt={row.name}
              className="rounded-lg"
            />
          ) : (
            <AvatarFallback className="rounded-lg bg-brandAlt-200 text-xs font-medium text-brand-900">
              {generateInitialsFromName(row.name)}
            </AvatarFallback>
          )}
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium leading-5 text-foreground">
              {row.name}
            </p>
            {row.isCurrentUser && (
              <span className="inline-flex h-4 shrink-0 items-center rounded-full bg-brand-50 px-1.5 text-[10px] font-medium text-brand-900 ring-1 ring-inset ring-brand-800/15">
                You
              </span>
            )}
          </div>
          <p className="truncate text-xs leading-4 text-gray-550">
            {row.type === "invitation" ? "pending invitation" : row.email}
          </p>
        </div>
      </div>

      {config.showSubEntityColumn && (
        <div className="w-[200px] flex gap-1.5 flex-wrap">
          {row.subEntities.map((entity) => (
            <span
              key={entity.id}
              className="rounded-full bg-slate-900/[0.04] px-2 py-0.5 text-[10px] text-gray-550"
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

      <div className="w-[60px] flex justify-end">
        {config.canManageMembers &&
          (row.type === "invitation" ||
            (row.isDirect && !row.isCurrentUser)) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={`Actions for ${row.name}`}
                  variant="ghost"
                  size="sm"
                  className="size-7 rounded-full p-0 hover:bg-brandAlt-100"
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
                      className="text-error-700 focus:bg-error-50 focus:text-error-700"
                      onClick={() => onRevokeInvitation?.(row.invitationId)}
                    >
                      Revoke invitation
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    className="text-error-700 focus:bg-error-50 focus:text-error-700"
                    onClick={() => onRemoveMember?.(row.id)}
                  >
                    Remove member
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: MemberStatus }) {
  switch (status) {
    case "active":
      return <Check aria-label="Active" className="size-4 text-brand-700" />;
    case "inactive":
      return <X aria-label="Inactive" className="size-4 text-error-700" />;
    case "pending":
      return (
        <Hourglass aria-label="Pending" className="size-4 text-gray-550" />
      );
  }
}
