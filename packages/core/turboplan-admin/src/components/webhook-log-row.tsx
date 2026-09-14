"use client";

import {
  Badge,
  Checkbox,
  TableCell,
  TableRow,
} from "@wildfires-org/turboplan-utils";

import { formatDate, formatTime } from "../format-date";
import type { WebhookLog } from "../hooks/use-webhook-logs";
import { WebhookLogStatusBadge } from "./webhook-log-status-badge";

export type LogGroup = {
  runId: string | null;
  logs: WebhookLog[];
};

export const formatDuration = (ms: number) =>
  (Math.round(ms / 100) / 10).toFixed(1) + "s";

export const LogRow = ({
  log,
  isSelected,
  onToggleSelect,
  onClick,
}: {
  log: WebhookLog;
  isSelected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
}) => {
  return (
    <TableRow onClick={onClick} className="cursor-pointer last:border-b-0">
      <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
      </TableCell>
      <TableCell className="py-3 font-mono text-xs max-w-[200px] truncate text-muted-foreground">
        {log.runId || "-"}
      </TableCell>
      <TableCell className="py-3">
        <Badge variant="secondary" className="text-xs">
          {log.source}
        </Badge>
      </TableCell>
      <TableCell className="py-3 font-mono text-xs max-w-[300px] truncate">
        {log.path}
      </TableCell>
      <TableCell className="py-3">
        <WebhookLogStatusBadge status={log.responseStatus} />
      </TableCell>
      <TableCell className="py-3 tabular-nums">
        {formatDuration(log.durationMs)}
      </TableCell>
      <TableCell className="py-3 whitespace-nowrap">
        {formatTime(log.createdAt)}
      </TableCell>
      <TableCell className="py-3 whitespace-nowrap text-muted-foreground">
        {formatDate(log.createdAt)}
      </TableCell>
    </TableRow>
  );
};
