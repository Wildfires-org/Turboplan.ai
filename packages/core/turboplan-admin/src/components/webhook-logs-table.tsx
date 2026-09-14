"use client";

import * as React from "react";
import { useState } from "react";

import { ChevronRight } from "lucide-react";

import {
  Badge,
  Checkbox,
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wildfires-org/turboplan-utils";

import type { WebhookLog } from "../hooks/use-webhook-logs";
import type { LogGroup } from "./webhook-log-row";
import { LogRow } from "./webhook-log-row";

interface WebhookLogsTableProps {
  logs: WebhookLog[];
  groups: LogGroup[];
  selectedIds: Set<string>;
  onToggleSelectAll: () => void;
  onToggleSelectRow: (id: string) => void;
  onToggleSelectGroup: (groupLogs: WebhookLog[]) => void;
  onSelectLog: (id: string) => void;
  isAllSelected: boolean;
}

export const WebhookLogsTable = ({
  logs,
  groups,
  selectedIds,
  onToggleSelectAll,
  onToggleSelectRow,
  onToggleSelectGroup,
  onSelectLog,
  isAllSelected,
}: WebhookLogsTableProps) => {
  const [collapsedRunIds, setCollapsedRunIds] = useState<Set<string>>(
    new Set(),
  );

  const toggleExpand = (runId: string) => {
    setCollapsedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-10">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={onToggleSelectAll}
              />
            </TableHead>
            <TableHead>Run ID</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Path</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-12 text-center text-muted-foreground"
              >
                No webhook logs found.
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => {
              if (group.runId === null) {
                const log = group.logs[0];
                return (
                  <LogRow
                    key={log.id}
                    log={log}
                    isSelected={selectedIds.has(log.id)}
                    onToggleSelect={() => onToggleSelectRow(log.id)}
                    onClick={() => onSelectLog(log.id)}
                  />
                );
              }

              const isExpanded = !collapsedRunIds.has(group.runId);
              const groupIds = group.logs.map((l) => l.id);
              const allGroupSelected = groupIds.every((id) =>
                selectedIds.has(id),
              );

              return (
                <React.Fragment key={group.runId}>
                  <TableRow
                    className="bg-muted/30 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(group.runId!)}
                  >
                    <TableCell
                      className="py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={allGroupSelected}
                        onCheckedChange={() => onToggleSelectGroup(group.logs)}
                      />
                    </TableCell>
                    <TableCell className="py-2 font-mono text-xs" colSpan={6}>
                      <div className="flex items-center gap-2">
                        <ChevronRight
                          className={cn(
                            "size-4 transition-transform",
                            isExpanded && "rotate-90",
                          )}
                        />
                        <span className="font-medium">{group.runId}</span>
                        <Badge variant="secondary" className="text-xs">
                          {group.logs.length}{" "}
                          {group.logs.length === 1 ? "entry" : "entries"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="py-2" />
                  </TableRow>
                  {isExpanded &&
                    group.logs.map((log) => (
                      <LogRow
                        key={log.id}
                        log={log}
                        isSelected={selectedIds.has(log.id)}
                        onToggleSelect={() => onToggleSelectRow(log.id)}
                        onClick={() => onSelectLog(log.id)}
                      />
                    ))}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
