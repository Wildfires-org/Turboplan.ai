"use client";

import { Fragment, useState } from "react";

import {
  ChevronDown,
  ChevronRight,
  Download,
  FileSignature,
  FileText,
} from "lucide-react";

import { Badge, Button, Skeleton } from "@wildfires-org/turboplan-utils";

import { useSigningRequests } from "../hooks/use-signing-requests";
import {
  getCurrentRecipient,
  getRecipientIndicator,
  getSigningProgress,
  isUsersTurn,
  sortRecipients,
} from "../recipient-status";
import type { SigningRecipient, SigningRequest } from "../types";
import { SignRequestFlow } from "./sign-request-flow";

interface ProjectSigningPageProps {
  projectId: string;
  currentUserId: string;
}

const STATUS_BADGE_MAP: Record<
  SigningRequest["status"],
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
    label: string;
  }
> = {
  draft: { variant: "secondary", label: "Draft" },
  pending: {
    variant: "outline",
    className: "text-amber-600 border-amber-300",
    label: "Pending",
  },
  completed: {
    variant: "default",
    className: "bg-green-600 hover:bg-green-600/80 border-green-600",
    label: "Completed",
  },
  rejected: { variant: "destructive", label: "Rejected" },
  cancelled: { variant: "secondary", label: "Cancelled" },
};

const RecipientBadge = ({
  recipient,
  currentRecipientUserId,
}: {
  recipient: SigningRecipient;
  currentRecipientUserId: string | null;
}) => {
  const indicator = getRecipientIndicator(recipient, currentRecipientUserId);
  return (
    <Badge variant="outline" className={`text-xs ${indicator.className}`}>
      {indicator.label}
    </Badge>
  );
};

const RecipientList = ({ request }: { request: SigningRequest }) => {
  const current = getCurrentRecipient(request.recipients);
  const ordered = sortRecipients(request.recipients);
  const sequential = request.signingMode === "sequential";

  return (
    <div className="flex flex-col gap-2 bg-muted/30 px-6 py-3">
      {ordered.map((recipient, index) => (
        <div key={recipient.userId} className="flex items-center gap-3 text-sm">
          {sequential && (
            <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground">
              {index + 1}.
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">
            {recipient.name}
            {recipient.role === "cc" && (
              <span className="ml-1.5 text-xs text-muted-foreground">(CC)</span>
            )}
          </span>
          {recipient.rejectionReason && (
            <span className="truncate text-xs text-red-600">
              {recipient.rejectionReason}
            </span>
          )}
          <RecipientBadge
            recipient={recipient}
            currentRecipientUserId={current?.userId ?? null}
          />
        </div>
      ))}
    </div>
  );
};

export const ProjectSigningPage = ({
  projectId,
  currentUserId,
}: ProjectSigningPageProps) => {
  const { signingRequests, isLoading, mutate } = useSigningRequests(projectId);
  const [signingRequestId, setSigningRequestId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSignClose = () => {
    setSigningRequestId(null);
    mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Signing Requests</h2>

      {isLoading ? (
        <div className="rounded-lg border">
          <div className="flex flex-col gap-4 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : signingRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-16">
          <FileText className="size-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No signing requests yet
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="px-4 py-3 font-medium">Document</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Waiting on</th>
                <th className="px-4 py-3 font-medium">Last activity</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {signingRequests.map((request) => {
                const statusConfig = STATUS_BADGE_MAP[request.status];
                const progress = getSigningProgress(request.recipients);
                const current = getCurrentRecipient(request.recipients);
                const myTurn =
                  request.status === "pending" &&
                  isUsersTurn(request.recipients, currentUserId);
                const isExpanded = expanded.has(request.id);
                const canDownload =
                  request.status === "completed" && request.signedDocumentUrl;

                return (
                  <Fragment key={request.id}>
                    <tr className="border-b last:border-b-0">
                      <td className="px-4 py-3 text-sm font-medium">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-left hover:text-primary"
                          onClick={() => toggleExpanded(request.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          {request.title}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={statusConfig.variant}
                          className={statusConfig.className}
                        >
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {progress.signed}/{progress.total}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {request.status === "pending" ? (
                          myTurn ? (
                            <span className="font-medium text-indigo-600">
                              Your turn
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {current ? `Waiting on ${current.name}` : "—"}
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(request.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {myTurn && (
                            <Button
                              size="sm"
                              onClick={() => setSigningRequestId(request.id)}
                            >
                              <FileSignature className="mr-1.5 size-3.5" />
                              Sign
                            </Button>
                          )}
                          {canDownload && (
                            <Button size="sm" variant="outline" asChild>
                              <a
                                href={request.signedDocumentUrl!}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="mr-1.5 size-3.5" />
                                Download
                              </a>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <RecipientList request={request} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {signingRequestId && (
        <SignRequestFlow
          signingRequestId={signingRequestId}
          open={true}
          onClose={handleSignClose}
        />
      )}
    </div>
  );
};
