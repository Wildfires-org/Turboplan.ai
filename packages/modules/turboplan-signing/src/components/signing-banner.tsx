"use client";

import { ExternalLink, FileSignature } from "lucide-react";

import { Button, safeExternalUrl } from "@wildfires-org/turboplan-utils";

import { useMySigningRequest } from "../hooks/use-signing-requests";

interface SigningBannerProps {
  documentId: string;
}

export const SigningBanner = ({ documentId }: SigningBannerProps) => {
  const { signingRequest, isLoading } = useMySigningRequest(documentId);
  const signingUrl = safeExternalUrl(signingRequest?.signingUrl);

  if (isLoading || !signingUrl) {
    return null;
  }

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
      <div className="flex items-center gap-2 text-sm">
        <FileSignature className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-amber-800 dark:text-amber-200">
          Your signature has been requested on this document.
        </span>
      </div>
      <Button size="sm" onClick={() => window.open(signingUrl, "_blank")}>
        <ExternalLink className="mr-1.5 size-3.5" />
        Sign Document
      </Button>
    </div>
  );
};
