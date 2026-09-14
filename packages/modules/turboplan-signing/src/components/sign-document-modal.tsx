"use client";

import { EmbedSignDocument } from "@documenso/embed-react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@wildfires-org/turboplan-utils";

import { useCompleteSigningRequest } from "../hooks/use-signing-requests";

interface SignDocumentModalProps {
  signingToken: string;
  host: string;
  signingRequestId: string;
  onCompleted?: () => void;
  onClose: () => void;
}

export const SignDocumentModal = ({
  signingToken,
  host,
  signingRequestId,
  onCompleted,
  onClose,
}: SignDocumentModalProps) => {
  const { completeSigningRequest } = useCompleteSigningRequest();

  if (typeof document === "undefined") {
    return null;
  }

  // Portal to <body> so the overlay escapes any ancestor stacking context (the
  // artifact panel uses transforms, which would otherwise re-anchor `fixed` and
  // let the chat render on top). Required for the inline-dialog path, which
  // renders this modal directly rather than through SignRequestFlow's portal.
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="relative flex h-[90vh] w-[90vw] max-w-4xl flex-col overflow-hidden rounded-lg bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium">Sign Document</span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <EmbedSignDocument
            className="h-full w-full border-0"
            host={host}
            token={signingToken}
            onDocumentCompleted={() => {
              toast.success("Document signed successfully");
              // Documenso seals the signed PDF asynchronously, so /complete may
              // not be ready on the first try — retry a few times before giving up.
              const saveSigned = async () => {
                const maxRetries = 5;
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                  try {
                    await completeSigningRequest({ signingRequestId });
                    return;
                  } catch {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                  }
                }
                toast.error(
                  "Signed document could not be saved. Please try again.",
                );
              };
              // Await the save before closing so the parent's refetch (run on
              // close) sees the recorded signature instead of stale state.
              void (async () => {
                await saveSigned();
                onCompleted?.();
                onClose();
              })();
            }}
            onDocumentRejected={({ reason }) => {
              toast.error(`Document rejected: ${reason}`);
              onClose();
            }}
            onDocumentError={(error) => {
              toast.error(`Signing error: ${error}`);
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};
