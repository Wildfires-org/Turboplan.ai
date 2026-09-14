"use client";

import { useState } from "react";

import { FileSignature, FileText } from "lucide-react";

import { Badge, Button, Skeleton } from "@wildfires-org/turboplan-utils";

import {
  type SigningRequestWithProject,
  useMyPendingSignatures,
} from "../hooks/use-signing-requests";
import { SignRequestFlow } from "./sign-request-flow";

interface MySignaturesPageProps {
  organizationId: string;
}

const getRequesterName = (
  requester: SigningRequestWithProject["requester"],
) => {
  if (!requester) {
    return "Unknown";
  }

  const name = [requester.firstName, requester.lastName]
    .filter(Boolean)
    .join(" ");
  return name || "Unknown";
};

export const MySignaturesPage = ({ organizationId }: MySignaturesPageProps) => {
  const { signingRequests, isLoading, mutate } =
    useMyPendingSignatures(organizationId);
  const [signingRequestId, setSigningRequestId] = useState<string | null>(null);

  const handleSignClose = () => {
    setSigningRequestId(null);
    mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">My Pending Signatures</h2>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : signingRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-16">
          <FileText className="size-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No pending signatures
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {signingRequests.map((request) => {
            const signingPageUrl = `/organizations/${request.orgSlug}/offices/${request.officeSlug}/projects/${request.projectSlug}/signing`;

            return (
              <div
                key={request.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{request.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {request.status}
                    </Badge>
                  </div>
                  <a
                    href={signingPageUrl}
                    className="text-sm text-primary hover:underline"
                  >
                    {request.projectName}
                  </a>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>From: {getRequesterName(request.requester)}</span>
                    <span>
                      {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setSigningRequestId(request.id)}
                >
                  <FileSignature className="mr-1.5 size-3.5" />
                  Sign Now
                </Button>
              </div>
            );
          })}
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
