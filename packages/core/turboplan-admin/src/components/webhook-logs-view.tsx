"use client";

import { useMemo, useState } from "react";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wildfires-org/turboplan-utils";

import type { WebhookLog, WebhookLogsFilters } from "../hooks/use-webhook-logs";
import { useWebhookLogs } from "../hooks/use-webhook-logs";
import {
  AdminErrorState,
  AdminFilterBar,
  AdminLoadingSkeleton,
} from "./admin-filter-bar";
import { WebhookLogDeleteDialog } from "./webhook-log-delete-dialog";
import { WebhookLogDetailDialog } from "./webhook-log-detail-dialog";
import type { LogGroup } from "./webhook-log-row";
import { WebhookLogsTable } from "./webhook-logs-table";

const groupLogsByRunId = (logs: WebhookLog[]): LogGroup[] => {
  const grouped = new Map<string, WebhookLog[]>();
  const ungrouped: WebhookLog[] = [];
  for (const log of logs) {
    if (log.runId) {
      const existing = grouped.get(log.runId);
      if (existing) {
        existing.push(log);
      } else {
        grouped.set(log.runId, [log]);
      }
    } else {
      ungrouped.push(log);
    }
  }
  const result: LogGroup[] = [];
  for (const [runId, groupLogs] of grouped) {
    result.push({ runId, logs: groupLogs });
  }
  for (const log of ungrouped) {
    result.push({ runId: null, logs: [log] });
  }
  return result;
};

export const WebhookLogsView = () => {
  const [filters, setFilters] = useState<WebhookLogsFilters>({});
  const [draftSource, setDraftSource] = useState<
    WebhookLogsFilters["source"] | "all"
  >("all");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { logs, isLoading, error, refreshLogs, deleteWebhookLogs } =
    useWebhookLogs(filters);

  const groups = useMemo(() => groupLogsByRunId(logs), [logs]);

  const allVisibleIds = useMemo(() => logs.map((l) => l.id), [logs]);
  const isAllSelected =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectGroup = (groupLogs: WebhookLog[]) => {
    const groupIds = groupLogs.map((l) => l.id);
    const allSelected = groupIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of groupIds) {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) {
      return;
    }
    try {
      await deleteWebhookLogs({ ids: Array.from(selectedIds) });
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to delete webhook logs");
    }
  };

  // Radix Select types onValueChange as (string) => void, so we cast to our narrower union
  const handleSourceChange = (value: string) => {
    setDraftSource(value as WebhookLogsFilters["source"] | "all");
  };

  const applyFilters = () => {
    const next: WebhookLogsFilters = {};
    if (draftSource !== "all") {
      next.source = draftSource;
    }
    setFilters(next);
  };

  const clearFilters = () => {
    setDraftSource("all");
    setFilters({});
  };

  return (
    <div className="space-y-4">
      <AdminFilterBar
        onApply={applyFilters}
        onClear={clearFilters}
        onRefresh={() => refreshLogs()}
        isLoading={isLoading}
        extraActions={
          selectedIds.size > 0 ? (
            <Button
              size="sm"
              className="h-9"
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="size-4 mr-1" />
              Delete selected ({selectedIds.size})
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Source
          </label>
          <Select value={draftSource} onValueChange={handleSourceChange}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="bootstrapper">Bootstrapper</SelectItem>
              <SelectItem value="cataloger">Cataloger</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </AdminFilterBar>

      {error && <AdminErrorState error={error} />}

      {isLoading && <AdminLoadingSkeleton />}

      {!isLoading && !error && (
        <WebhookLogsTable
          logs={logs}
          groups={groups}
          selectedIds={selectedIds}
          isAllSelected={isAllSelected}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelectRow={toggleSelectRow}
          onToggleSelectGroup={toggleSelectGroup}
          onSelectLog={setSelectedLogId}
        />
      )}

      {selectedLogId && (
        <WebhookLogDetailDialog
          logId={selectedLogId}
          onClose={() => setSelectedLogId(null)}
        />
      )}

      <WebhookLogDeleteDialog
        count={selectedIds.size}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
      />
    </div>
  );
};
