"use client";

import { useMemo, useState } from "react";

import { ArrowUpDown } from "lucide-react";

import { cn, GLASS_CARD_CLASS } from "@wildfires-org/turboplan-utils";

import type { MemberRoleType } from "../../types";
import { MemberRowItem } from "./member-row-item";
import { MembersTableFilters } from "./members-table-filters";
import { SkeletonRows } from "./skeleton-rows";
import type {
  AccessFilterValue,
  MemberRow,
  MembersTableConfig,
  RoleFilterValue,
  StatusFilterValue,
} from "./types";
import { collectSubEntities, ROLE_ORDER, STATUS_ORDER } from "./utils";

type SortField = "subEntities" | "role" | "status";
type SortDirection = "asc" | "desc";

interface MembersTableProps {
  rows: MemberRow[];
  config: MembersTableConfig;
  searchQuery?: string;
  onRoleChange?: (rowId: string, newRole: MemberRoleType) => void;
  onRemoveMember?: (userId: string) => void;
  onResendInvitation?: (invitationId: string) => void;
  onRevokeInvitation?: (invitationId: string) => void;
  isLoading?: boolean;
}

export function MembersTable({
  rows,
  config,
  searchQuery,
  onRoleChange,
  onRemoveMember,
  onResendInvitation,
  onRevokeInvitation,
  isLoading = false,
}: MembersTableProps) {
  const [roleFilter, setRoleFilter] = useState<RoleFilterValue>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [accessFilter, setAccessFilter] = useState<AccessFilterValue>(
    config.showAccessFilter ? "direct" : "all",
  );
  const [subEntityFilter, setSubEntityFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState(50);

  const allSubEntities = useMemo(() => collectSubEntities(rows), [rows]);

  const filteredAndSortedRows = useMemo(() => {
    let result = rows;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          row.email.toLowerCase().includes(q),
      );
    }

    if (roleFilter !== "all") {
      result = result.filter((row) => row.role === roleFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((row) => row.status === statusFilter);
    }
    if (accessFilter === "direct") {
      result = result.filter((row) => row.isDirect === true);
    } else if (accessFilter === "inherited") {
      result = result.filter((row) => row.isDirect === false);
    }
    if (subEntityFilter !== "all") {
      result = result.filter((row) =>
        row.subEntities.some((e) => e.id === subEntityFilter),
      );
    }

    if (sortField) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "subEntities": {
            const aName = a.subEntities[0]?.name ?? "";
            const bName = b.subEntities[0]?.name ?? "";
            cmp = aName.localeCompare(bName);
            break;
          }
          case "role":
            cmp = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
            break;
          case "status":
            cmp =
              (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
            break;
        }
        return sortDirection === "desc" ? -cmp : cmp;
      });
    }

    return result.slice(0, pageSize);
  }, [
    rows,
    searchQuery,
    roleFilter,
    statusFilter,
    accessFilter,
    subEntityFilter,
    sortField,
    sortDirection,
    pageSize,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const headerCellClass =
    "flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-550 select-none";

  return (
    <div>
      <MembersTableFilters
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        accessFilter={accessFilter}
        onAccessFilterChange={setAccessFilter}
        subEntityFilter={subEntityFilter}
        onSubEntityFilterChange={setSubEntityFilter}
        subEntities={allSubEntities}
        config={config}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        totalCount={rows.length}
      />

      <div className={cn(GLASS_CARD_CLASS, "overflow-hidden")}>
        <div className="flex items-center gap-4 border-b border-white/80 bg-white/40 px-6 py-3.5 dark:border-white/10 dark:bg-white/5">
          <div className={cn(headerCellClass, "flex-1 min-w-0")}>User</div>
          {config.showSubEntityColumn && (
            <button
              type="button"
              className={cn(headerCellClass, "w-[200px] cursor-pointer")}
              onClick={() => handleSort("subEntities")}
            >
              {config.subEntityLabel}
              <ArrowUpDown className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            className={cn(headerCellClass, "w-[120px] cursor-pointer")}
            onClick={() => handleSort("role")}
          >
            Role
            <ArrowUpDown className="size-3.5" />
          </button>
          <button
            type="button"
            className={cn(headerCellClass, "w-[100px] cursor-pointer")}
            onClick={() => handleSort("status")}
          >
            Status
            <ArrowUpDown className="size-3.5" />
          </button>
          {/* Always reserved: `canManageMembers` resolves after an async
              permission check, and a late column would shift every cell. */}
          <div className="w-[60px]" />
        </div>

        {isLoading ? (
          <SkeletonRows showSubEntityColumn={config.showSubEntityColumn} />
        ) : filteredAndSortedRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-550">
            No members found
          </div>
        ) : (
          filteredAndSortedRows.map((row) => (
            <MemberRowItem
              key={row.id}
              row={row}
              config={config}
              onRoleChange={onRoleChange}
              onRemoveMember={onRemoveMember}
              onResendInvitation={onResendInvitation}
              onRevokeInvitation={onRevokeInvitation}
            />
          ))
        )}
      </div>
    </div>
  );
}
