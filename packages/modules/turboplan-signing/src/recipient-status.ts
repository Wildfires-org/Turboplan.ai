import type { SigningRecipient } from "./types";

// Canonical recipient ordering, identical to the server gate: (order, userId).
export const sortRecipients = (
  recipients: SigningRecipient[],
): SigningRecipient[] =>
  [...recipients].sort(
    (a, b) => a.order - b.order || a.userId.localeCompare(b.userId),
  );

export const isSigner = (r: SigningRecipient): boolean => r.role !== "cc";

export type SigningProgress = { signed: number; total: number };

// Progress counts signers only — CC recipients never sign.
export const getSigningProgress = (
  recipients: SigningRecipient[],
): SigningProgress => {
  const signers = recipients.filter(isSigner);
  return {
    signed: signers.filter((r) => r.signingStatus === "signed").length,
    total: signers.length,
  };
};

// The recipient whose turn it currently is: lowest-order unsigned signer.
export const getCurrentRecipient = (
  recipients: SigningRecipient[],
): SigningRecipient | null =>
  sortRecipients(recipients).find(
    (r) => isSigner(r) && r.signingStatus === "not_signed",
  ) ?? null;

// True when the given user is a signer who has been released and hasn't signed —
// i.e. it is actually their turn (works for both parallel and sequential).
export const isUsersTurn = (
  recipients: SigningRecipient[],
  userId: string,
): boolean => {
  const row = recipients.find((r) => r.userId === userId);
  return (
    !!row &&
    isSigner(row) &&
    row.signingStatus === "not_signed" &&
    row.sendStatus === "sent"
  );
};

export type RecipientIndicatorKey =
  | "not_sent"
  | "awaiting"
  | "viewed"
  | "signed"
  | "rejected"
  | "current";

export type RecipientIndicator = {
  key: RecipientIndicatorKey;
  label: string;
  className: string;
};

const INDICATORS: Record<
  RecipientIndicatorKey,
  Omit<RecipientIndicator, "key">
> = {
  not_sent: {
    label: "Not sent",
    className: "text-muted-foreground border-border",
  },
  awaiting: { label: "Awaiting", className: "text-amber-600 border-amber-300" },
  viewed: { label: "Viewed", className: "text-blue-600 border-blue-300" },
  signed: {
    label: "Signed",
    className: "text-green-700 border-green-300 bg-green-50",
  },
  rejected: { label: "Rejected", className: "text-red-600 border-red-300" },
  current: { label: "Current", className: "text-indigo-600 border-indigo-300" },
};

// Derives the single six-state indicator for a recipient from the three status
// axes plus whose turn it is. CC recipients collapse to signed/awaiting since
// they don't have a signing step.
export const getRecipientIndicator = (
  recipient: SigningRecipient,
  currentRecipientUserId: string | null,
): RecipientIndicator => {
  let key: RecipientIndicatorKey;
  if (recipient.signingStatus === "rejected") {
    key = "rejected";
  } else if (recipient.signingStatus === "signed") {
    key = "signed";
  } else if (
    isSigner(recipient) &&
    recipient.userId === currentRecipientUserId
  ) {
    key = "current";
  } else if (recipient.sendStatus === "not_sent") {
    key = "not_sent";
  } else if (recipient.readStatus === "opened") {
    key = "viewed";
  } else {
    key = "awaiting";
  }
  return { key, ...INDICATORS[key] };
};
