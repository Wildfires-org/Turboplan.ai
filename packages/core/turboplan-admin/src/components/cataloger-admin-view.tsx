"use client";

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wildfires-org/turboplan-utils";

import { formatDate, formatTime } from "../format-date";
import type {
  CatalogerRunItem,
  CatalogerRunsFilters,
} from "../hooks/use-cataloger";
import { useCatalogerRuns } from "../hooks/use-cataloger";
import type { CatalogerRunStatus } from "../types";
import {
  AdminErrorState,
  AdminFilterBar,
  AdminLoadingSkeleton,
} from "./admin-filter-bar";
import { CatalogerRunDetailDialog } from "./cataloger-run-detail-dialog";
import { CatalogerStatusBadge } from "./cataloger-status-badge";

const RunRow = ({
  run,
  onClick,
}: {
  run: CatalogerRunItem;
  onClick: () => void;
}) => {
  return (
    <TableRow onClick={onClick} className="cursor-pointer last:border-b-0">
      <TableCell className="py-3 font-mono text-xs max-w-[200px] truncate text-muted-foreground">
        {run.externalRunId || "-"}
      </TableCell>
      <TableCell className="py-3">
        <div className="text-sm">{run.userName || run.userEmail}</div>
        {run.userName && (
          <div className="text-xs text-muted-foreground">{run.userEmail}</div>
        )}
      </TableCell>
      <TableCell className="py-3 max-w-[300px]">
        <span className="block text-sm truncate" title={run.message}>
          {run.message}
        </span>
      </TableCell>
      <TableCell className="py-3">
        <CatalogerStatusBadge status={run.status} />
      </TableCell>
      <TableCell className="py-3 tabular-nums">{run.entriesCount}</TableCell>
      <TableCell className="py-3 whitespace-nowrap">
        {formatTime(run.createdAt)}
      </TableCell>
      <TableCell className="py-3 whitespace-nowrap text-muted-foreground">
        {formatDate(run.createdAt)}
      </TableCell>
    </TableRow>
  );
};

export const CatalogerAdminView = () => {
  const [filters, setFilters] = useState<CatalogerRunsFilters>({});
  const [draftStatus, setDraftStatus] = useState<CatalogerRunStatus | "all">(
    "all",
  );
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { runs, isLoading, error, refreshRuns } = useCatalogerRuns(filters);

  // Radix Select types onValueChange as (string) => void, so we cast to our narrower union
  const handleStatusChange = (value: string) => {
    setDraftStatus(value as CatalogerRunStatus | "all");
  };

  const applyFilters = () => {
    const next: CatalogerRunsFilters = {};
    if (draftStatus !== "all") {
      next.status = draftStatus;
    }
    setFilters(next);
  };

  const clearFilters = () => {
    setDraftStatus("all");
    setFilters({});
  };

  return (
    <div className="space-y-4">
      <AdminFilterBar
        onApply={applyFilters}
        onClear={clearFilters}
        onRefresh={refreshRuns}
        isLoading={isLoading}
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <Select value={draftStatus} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="initializing">Initializing</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </AdminFilterBar>

      {error && <AdminErrorState error={error} />}

      {isLoading && <AdminLoadingSkeleton />}

      {/* Table */}
      {!isLoading && !error && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Run ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entries</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No cataloger runs found.
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    onClick={() => setSelectedRunId(run.id)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail dialog */}
      {selectedRunId && (
        <CatalogerRunDetailDialog
          runId={selectedRunId}
          onClose={() => setSelectedRunId(null)}
        />
      )}
    </div>
  );
};
