"use client";

import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  JsonBlock,
} from "@wildfires-org/turboplan-utils";

import { formatDate, formatTime } from "../format-date";
import { useWebhookLogDetail } from "../hooks/use-webhook-logs";
import { formatDuration } from "./webhook-log-row";
import { WebhookLogStatusBadge } from "./webhook-log-status-badge";

interface WebhookLogDetailDialogProps {
  logId: string;
  onClose: () => void;
}

export const WebhookLogDetailDialog = ({
  logId,
  onClose,
}: WebhookLogDetailDialogProps) => {
  const { log, isLoading, error } = useWebhookLogDetail(logId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Webhook Log Detail</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">Failed to load: {error}</p>
        )}

        {log && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">
                  Source
                </span>
                <p>{log.source}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">
                  Status
                </span>
                <p>
                  <WebhookLogStatusBadge status={log.responseStatus} />
                </p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">
                  Method
                </span>
                <p className="font-mono">{log.method}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">
                  Duration
                </span>
                <p>
                  {formatDuration(log.durationMs)} ({log.durationMs}ms)
                </p>
              </div>
              <div className="col-span-2">
                <span className="font-medium text-muted-foreground">Path</span>
                <p className="font-mono text-xs break-all">{log.path}</p>
              </div>
              {log.runId && (
                <div className="col-span-2">
                  <span className="font-medium text-muted-foreground">
                    Run ID
                  </span>
                  <p className="font-mono text-xs break-all">{log.runId}</p>
                </div>
              )}
              <div className="col-span-2">
                <span className="font-medium text-muted-foreground">
                  Timestamp
                </span>
                <p>
                  {formatTime(log.createdAt)}, {formatDate(log.createdAt)}
                </p>
              </div>
            </div>

            <JsonBlock label="Request Headers" data={log.requestHeaders} />
            <JsonBlock label="Request Body" data={log.requestBody} />
            <JsonBlock label="Response Body" data={log.responseBody} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
