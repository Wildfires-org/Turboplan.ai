"use client";

import { useEffect, useRef, useState } from "react";

import { Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { useSignToken } from "../hooks/use-signing-requests";
import { SignDocumentModal } from "./sign-document-modal";

interface SignRequestFlowProps {
  signingRequestId: string;
  open: boolean;
  onClose: () => void;
}

type SigningData = {
  token: string;
  host: string;
  signingRequestId: string;
};

/**
 * Opens the embedded signing modal for an existing request the current user is a
 * recipient of. Mints the user's signing token on demand (GET /:id/sign-token),
 * which enforces the sequential turn gate. Unlike the old self-sign flow, closing
 * without signing does NOT void the envelope — it is shared across all recipients.
 */
export const SignRequestFlow = ({
  signingRequestId,
  open,
  onClose,
}: SignRequestFlowProps) => {
  const { getSignToken } = useSignToken();
  const [signingData, setSigningData] = useState<SigningData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Guards against re-fetching the token on every render while open.
  const requestedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      requestedRef.current = null;
      return;
    }
    if (signingData || requestedRef.current === signingRequestId) {
      return;
    }
    requestedRef.current = signingRequestId;
    setIsLoading(true);
    getSignToken(signingRequestId)
      .then((res) => {
        setSigningData({
          token: res.signingToken,
          host: res.host,
          signingRequestId: res.signingRequestId,
        });
      })
      .catch((err: unknown) => {
        // The fetcher carries the server's reason on `err.info` (e.g. "You have
        // already signed"). Closing triggers the parent's refetch, so the list
        // reflects the reconciled state.
        const reason =
          err && typeof err === "object" && "info" in err
            ? String((err as { info?: unknown }).info ?? "")
            : "";
        toast.error(
          reason || "Couldn't open the document for signing. Please try again.",
        );
        onClose();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [open, signingRequestId, signingData, getSignToken, onClose]);

  if (!open) {
    return null;
  }

  if (isLoading || !signingData) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
        <div className="flex items-center gap-3 rounded-lg bg-background px-6 py-4 shadow-xl">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Preparing document for signing...</span>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <SignDocumentModal
      signingToken={signingData.token}
      host={signingData.host}
      signingRequestId={signingData.signingRequestId}
      onCompleted={() => {
        setSigningData(null);
      }}
      onClose={() => {
        setSigningData(null);
        onClose();
      }}
    />,
    document.body,
  );
};
