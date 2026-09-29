"use client";

import { Eye } from "lucide-react";

import {
  cn,
  GLASS_CLASS,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wildfires-org/turboplan-utils";

import type {
  AccessFilterValue,
  MembersTableConfig,
  RoleFilterValue,
  StatusFilterValue,
  SubEntityTag,
} from "./types";

// Glass chip trigger, matching the dashboard FilterBar chips.
const CHIP_TRIGGER_CLASS = cn(
  GLASS_CLASS,
  "h-9 w-auto gap-1.5 rounded-full px-3 text-[13px] hover:bg-white/80 focus:ring-0 focus:ring-offset-0 data-[state=open]:bg-white/90 [&>span]:font-medium",
);

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface MembersTableFiltersProps {
  roleFilter: RoleFilterValue;
  onRoleFilterChange: (value: RoleFilterValue) => void;
  statusFilter: StatusFilterValue;
  onStatusFilterChange: (value: StatusFilterValue) => void;
  accessFilter: AccessFilterValue;
  onAccessFilterChange: (value: AccessFilterValue) => void;
  subEntityFilter: string;
  onSubEntityFilterChange: (value: string) => void;
  subEntities: SubEntityTag[];
  config: MembersTableConfig;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalCount: number;
}

export function MembersTableFilters({
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  accessFilter,
  onAccessFilterChange,
  subEntityFilter,
  onSubEntityFilterChange,
  subEntities,
  config,
  pageSize,
  onPageSizeChange,
}: MembersTableFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-4 sm:gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={roleFilter}
          onValueChange={(v) => onRoleFilterChange(v as RoleFilterValue)}
        >
          <SelectTrigger className={CHIP_TRIGGER_CLASS}>
            <span className="!font-normal text-gray-550">Role:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusFilterChange(v as StatusFilterValue)}
        >
          <SelectTrigger className={CHIP_TRIGGER_CLASS}>
            <span className="!font-normal text-gray-550">Status:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        {config.showAccessFilter && (
          <Select
            value={accessFilter}
            onValueChange={(v) => onAccessFilterChange(v as AccessFilterValue)}
          >
            <SelectTrigger className={CHIP_TRIGGER_CLASS}>
              <span className="!font-normal text-gray-550">Access:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="inherited">Inherited</SelectItem>
            </SelectContent>
          </Select>
        )}

        {config.showSubEntityFilter && (
          <Select
            value={subEntityFilter}
            onValueChange={onSubEntityFilterChange}
          >
            <SelectTrigger className={CHIP_TRIGGER_CLASS}>
              <span className="!font-normal text-gray-550">
                {config.subEntityLabel}:
              </span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {subEntities.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>
                  {entity.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Select
        value={String(pageSize)}
        onValueChange={(v) => onPageSizeChange(Number(v))}
      >
        <SelectTrigger className={cn(CHIP_TRIGGER_CLASS, "min-w-0 gap-2 pr-2")}>
          <Eye className="size-4 text-gray-550" aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
