import type { SigningRecipientRow } from "@wildfires-org/turboplan-db";

// Canonical recipient ordering used everywhere: (order asc, then userId asc).
// Ties share a step; userId is the stable tie-breaker so every caller — gate
// release, completion check, UI "current" indicator — agrees on the sequence.
export const sortRecipients = (
  recipients: SigningRecipientRow[],
): SigningRecipientRow[] =>
  [...recipients].sort(
    (a, b) => a.order - b.order || a.userId.localeCompare(b.userId),
  );

const isSigner = (r: SigningRecipientRow): boolean => r.role !== "cc";

// A request is fully signed once every non-CC recipient has signed. CC
// recipients never sign, so they're excluded from the completion gate.
export const allSignersSigned = (
  recipients: SigningRecipientRow[],
): boolean => {
  const signers = recipients.filter(isSigner);
  return (
    signers.length > 0 && signers.every((r) => r.signingStatus === "signed")
  );
};

// The next recipient to invite in sequential mode: the lowest-order unsigned,
// not-yet-rejected signer that hasn't been sent yet. Returns null when nobody
// is waiting to be released (everyone pending is already invited, or signed).
export const getNextToRelease = (
  recipients: SigningRecipientRow[],
): SigningRecipientRow | null =>
  sortRecipients(recipients).find(
    (r) =>
      isSigner(r) &&
      r.signingStatus === "not_signed" &&
      r.sendStatus !== "sent",
  ) ?? null;

// The recipient whose turn it currently is: the lowest-order unsigned signer by
// canonical order. Drives the "Current" / "Your turn" UI indicator. Independent
// of sendStatus so it also names the upcoming step in a paused sequence.
export const getCurrentRecipient = (
  recipients: SigningRecipientRow[],
): SigningRecipientRow | null =>
  sortRecipients(recipients).find(
    (r) => isSigner(r) && r.signingStatus === "not_signed",
  ) ?? null;
