import type { SigningRecipientRow } from "@wildfires-org/turboplan-db";

import { getEnvelopeStatus } from "./documenso-client";
import { allSignersSigned, getNextToRelease } from "./gate";

// Documenso's per-recipient signing status → our lowercase axis.
const ENVELOPE_SIGNING_STATUS: Record<
  string,
  "not_signed" | "signed" | "rejected"
> = {
  NOT_SIGNED: "not_signed",
  SIGNED: "signed",
  REJECTED: "rejected",
};

export const requesterDisplayName = (requester: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): string =>
  [requester.firstName, requester.lastName].filter(Boolean).join(" ") ||
  requester.email ||
  "A team member";

// Requester is always a signer when included. Given the raw recipient input and
// where the requester sits, returns the ordered list with `order` assigned:
// parallel -> everyone order 1; sequential -> 1..N in list position.
export const buildOrderedRecipients = (
  inputs: Array<{ userId: string; role: "signer" | "cc" }>,
  requesterUserId: string,
  requesterSigns: "first" | "last" | "no",
  signingMode: "parallel" | "sequential",
): Array<{ userId: string; role: "signer" | "cc"; order: number }> => {
  const others = inputs.filter((r) => r.userId !== requesterUserId);
  const requester = { userId: requesterUserId, role: "signer" as const };

  let ordered: Array<{ userId: string; role: "signer" | "cc" }>;
  if (requesterSigns === "no") {
    ordered = others;
  } else if (requesterSigns === "last") {
    ordered = [...others, requester];
  } else {
    ordered = [requester, ...others];
  }

  return ordered.map((r, i) => ({
    ...r,
    order: signingMode === "sequential" ? i + 1 : 1,
  }));
};

type EnvelopeRecipients = Awaited<
  ReturnType<typeof getEnvelopeStatus>
>["recipients"];

// Reconcile our recipient rows against Documenso (the source of truth): copy each
// recipient's latest signing status + signedAt, then advance the sequential gate
// by releasing the next unsigned signer. Pure — the caller persists and emails.
// Used by /complete and /:id/sign-token so a signature recorded on Documenso is
// reflected here even when the webhook never lands (e.g. localhost in dev).
export const applyEnvelopeSync = (
  record: {
    recipients: SigningRecipientRow[];
    signingMode: "parallel" | "sequential";
  },
  envelopeRecipients: EnvelopeRecipients,
  now: string,
): {
  recipients: SigningRecipientRow[];
  released: SigningRecipientRow | null;
} => {
  const synced: SigningRecipientRow[] = record.recipients.map((r) => {
    const er = envelopeRecipients.find((x) => x.email === r.email);
    const next = er ? ENVELOPE_SIGNING_STATUS[er.signingStatus] : undefined;
    if (!next || next === r.signingStatus) {
      return r;
    }
    return {
      ...r,
      signingStatus: next,
      signedAt:
        next === "signed" ? (r.signedAt ?? er?.signedAt ?? now) : r.signedAt,
    };
  });

  if (record.signingMode !== "sequential" || allSignersSigned(synced)) {
    return { recipients: synced, released: null };
  }
  const next = getNextToRelease(synced);
  if (!next) {
    return { recipients: synced, released: null };
  }
  const released: SigningRecipientRow = { ...next, sendStatus: "sent" };
  return {
    recipients: synced.map((r) =>
      r.userId === released.userId ? released : r,
    ),
    released,
  };
};
