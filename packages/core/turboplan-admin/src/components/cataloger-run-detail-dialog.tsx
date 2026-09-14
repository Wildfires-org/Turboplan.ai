"use client";

import { ExternalLink, Loader2 } from "lucide-react";

import { getWebEnv } from "@wildfires-org/turboplan-env";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wildfires-org/turboplan-utils";

import { formatDate, formatTime } from "../format-date";
import { useCatalogerRunDetail } from "../hooks/use-cataloger";
import { CatalogerStatusBadge } from "./cataloger-status-badge";

const { LANDING_URL } = getWebEnv();

interface CatalogerRunDetailDialogProps {
  runId: string;
  onClose: () => void;
}

export const CatalogerRunDetailDialog = ({
  runId,
  onClose,
}: CatalogerRunDetailDialogProps) => {
  const { run, entries, isLoading, error } = useCatalogerRunDetail(runId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cataloger Run Detail</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">Failed to load: {error}</p>
        )}

        {run && (
          <div className="space-y-6">
            {/* Run metadata */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {run.externalRunId && (
                <div>
                  <span className="font-medium text-muted-foreground">
                    Run ID
                  </span>
                  <p className="font-mono text-xs break-all">
                    {run.externalRunId}
                  </p>
                </div>
              )}
              <div>
                <span className="font-medium text-muted-foreground">
                  Status
                </span>
                <p>
                  <CatalogerStatusBadge status={run.status} />
                </p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">User</span>
                <p>{run.userName || run.userEmail}</p>
                {run.userName && (
                  <p className="text-xs text-muted-foreground">
                    {run.userEmail}
                  </p>
                )}
              </div>
              <div>
                <span className="font-medium text-muted-foreground">
                  Created
                </span>
                <p>
                  {formatTime(run.createdAt)}, {formatDate(run.createdAt)}
                </p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">
                  Updated
                </span>
                <p>
                  {formatTime(run.updatedAt)}, {formatDate(run.updatedAt)}
                </p>
              </div>
              {run.currentStep && (
                <div>
                  <span className="font-medium text-muted-foreground">
                    Current Step
                  </span>
                  <p>{run.currentStep}</p>
                </div>
              )}
              <div className="col-span-2">
                <span className="font-medium text-muted-foreground">
                  Message
                </span>
                <p className="text-xs break-all">{run.message}</p>
              </div>
            </div>

            {/* Entries table */}
            <div>
              <h3 className="text-sm font-medium mb-2">
                Entries ({entries.length})
              </h3>
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No entries created for this run.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Name</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Office</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => {
                        const catalogLink =
                          entry.organizationSlug &&
                          entry.officeSlug &&
                          entry.projectSlug
                            ? `${LANDING_URL}/catalog/${entry.organizationSlug}/${entry.officeSlug}/templates/${entry.projectSlug}`
                            : null;

                        const orgLink = entry.organizationSlug
                          ? `${LANDING_URL}/catalog/${entry.organizationSlug}`
                          : null;

                        const officeLink =
                          entry.organizationSlug && entry.officeSlug
                            ? `${LANDING_URL}/catalog/${entry.organizationSlug}/${entry.officeSlug}`
                            : null;

                        return (
                          <TableRow key={entry.id} className="last:border-b-0">
                            <TableCell>
                              {catalogLink ? (
                                <a
                                  href={catalogLink}
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {entry.name}
                                  <ExternalLink className="size-3" />
                                </a>
                              ) : (
                                entry.name
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {orgLink ? (
                                <a
                                  href={orgLink}
                                  className="text-primary hover:underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {entry.organizationName}
                                </a>
                              ) : (
                                entry.organizationName || "-"
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {officeLink ? (
                                <a
                                  href={officeLink}
                                  className="text-primary hover:underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {entry.officeName}
                                </a>
                              ) : (
                                entry.officeName || "-"
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatTime(entry.createdAt)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {formatDate(entry.createdAt)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
