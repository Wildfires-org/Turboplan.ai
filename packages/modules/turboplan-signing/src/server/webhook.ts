import { Hono } from "hono";

import { timingSafeCompare } from "@wildfires-org/turboplan-auth/secrets";
import type { SigningRecipientRow } from "@wildfires-org/turboplan-db";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";

import {
  type DocumensoConfig,
  resolveDocumensoConfig,
} from "./config-resolver";
import { allSignersSigned, getNextToRelease } from "./gate";
import { notifyRejection, sendCcCopies, sendInviteEmails } from "./notify";
import { persistSignedDocument } from "./persist";
import {
  getSigningRequest,
  getSigningRequestByEnvelopeId,
  updateSigningRequestStatus,
} from "./queries";

const webhookPayloadSchema = {
  isValid: (body: unknown): body is WebhookPayload => {
    if (!body || typeof body !== "object") {
      return false;
    }
    const obj = body as Record<string, unknown>;
    return typeof obj.event === "string" && obj.payload != null;
  },
};

type WebhookRecipient = {
  id: number;
  email: string;
  name: string;
  signingStatus: "NOT_SIGNED" | "SIGNED" | "REJECTED";
  readStatus?: "NOT_OPENED" | "OPENED";
  signedAt: string | null;
  rejectionReason: string | null;
};

type WebhookPayload = {
  event: string;
  payload: {
    id: number;
    externalId: string | null;
    title: string;
    status: string;
    completedAt: string | null;
    recipients: WebhookRecipient[];
  };
  createdAt: string;
  webhookEndpoint: string;
};

const SIGNING_STATUS_MAP: Record<string, "not_signed" | "signed" | "rejected"> =
  {
    NOT_SIGNED: "not_signed",
    SIGNED: "signed",
    REJECTED: "rejected",
  };

const requesterDisplayName = (requester: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): string =>
  [requester.firstName, requester.lastName].filter(Boolean).join(" ") ||
  requester.email ||
  "A team member";

export const signingWebhookRouter = new Hono();

signingWebhookRouter.post("/", async (c) => {
  const providedSecret = c.req.header("x-documenso-secret");
  if (!providedSecret) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const env = getApiEnv();
  // Fast path: the platform-default webhook secret needs no DB lookup.
  let authorized = timingSafeCompare(
    providedSecret,
    env.DOCUMENSO_WEBHOOK_SECRET,
  );

  const body = await c.req.json();
  if (!webhookPayloadSchema.isValid(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const { event, payload } = body;

  // Look up signing request by externalId (our signing request ID)
  let signingRequest = payload.externalId
    ? await getSigningRequest(payload.externalId)
    : null;

  // Fallback: try matching by envelope ID stored in our records
  if (!signingRequest) {
    const byEnvelope = await getSigningRequestByEnvelopeId(String(payload.id));
    if (byEnvelope) {
      signingRequest = await getSigningRequest(byEnvelope.id);
    }
  }

  // For organizations using a self-hosted Documenso instance, verify against the
  // per-org webhook secret. Only resolved when the global secret didn't match.
  let docConfig: DocumensoConfig | null = null;
  if (signingRequest) {
    docConfig = await resolveDocumensoConfig(signingRequest.projectId);
    if (!authorized && docConfig?.webhookSecret) {
      authorized = timingSafeCompare(providedSecret, docConfig.webhookSecret);
    }
  }

  if (!authorized) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!signingRequest) {
    return c.json({ error: "Signing request not found" }, 404);
  }

  // Terminal states are final. Events that drive the request back to "pending"
  // (a recipient opening/signing) must never resurrect a completed/rejected/
  // cancelled request or overwrite its recipients — e.g. a recipient opening the
  // link after the request finished, or a reordered/retried Documenso delivery.
  // COMPLETED/REJECTED/CANCELLED still flow through to their own idempotent
  // handlers (e.g. a late COMPLETED that still needs to persist the signed PDF).
  // Ack with 200 so Documenso stops retrying.
  const isTerminal =
    signingRequest.status === "completed" ||
    signingRequest.status === "rejected" ||
    signingRequest.status === "cancelled";
  const isRevertingEvent =
    event === "DOCUMENT_OPENED" ||
    event === "DOCUMENT_SIGNED" ||
    event === "DOCUMENT_RECIPIENT_COMPLETED";
  if (isTerminal && isRevertingEvent) {
    return c.json({ ok: true });
  }

  const now = new Date().toISOString();
  const requesterName = requesterDisplayName(signingRequest.requester);

  switch (event) {
    case "DOCUMENT_OPENED": {
      // Mark which recipients have now opened the document (readStatus axis).
      const updatedRecipients = signingRequest.recipients.map((r) => {
        const wr = payload.recipients.find((w) => w.email === r.email);
        if (!wr || wr.readStatus !== "OPENED" || r.readStatus === "opened") {
          return r;
        }
        return {
          ...r,
          readStatus: "opened" as const,
          viewedAt: r.viewedAt ?? now,
        };
      });

      await updateSigningRequestStatus(signingRequest.id, "pending", {
        recipients: updatedRecipients,
      });
      break;
    }

    case "DOCUMENT_SIGNED":
    case "DOCUMENT_RECIPIENT_COMPLETED": {
      // Record each recipient's signing status + signedAt from the webhook.
      const updatedRecipients = signingRequest.recipients.map((r) => {
        const wr = payload.recipients.find((w) => w.email === r.email);
        if (!wr) {
          return r;
        }
        const status = SIGNING_STATUS_MAP[wr.signingStatus] ?? r.signingStatus;
        return {
          ...r,
          signingStatus: status,
          signedAt:
            status === "signed"
              ? (r.signedAt ?? wr.signedAt ?? now)
              : r.signedAt,
        };
      });

      // Sequential gate: release the next signer (lowest-order unsigned non-CC
      // not yet sent) and email them. Idempotent — getNextToRelease skips anyone
      // already sent, so a duplicate webhook won't double-invite.
      let recipientsToPersist: SigningRecipientRow[] = updatedRecipients;
      if (
        signingRequest.signingMode === "sequential" &&
        !allSignersSigned(updatedRecipients)
      ) {
        const next = getNextToRelease(updatedRecipients);
        if (next) {
          const released: SigningRecipientRow = {
            ...next,
            sendStatus: "sent",
          };
          recipientsToPersist = updatedRecipients.map((r) =>
            r.userId === next.userId ? released : r,
          );
          void sendInviteEmails(
            signingRequest.projectId,
            [released],
            requesterName,
            signingRequest.title,
          );
        }
      }

      await updateSigningRequestStatus(signingRequest.id, "pending", {
        recipients: recipientsToPersist,
      });

      // Timeline: attribute the signature to the signer (source: documenso).
      const signedNow = payload.recipients.find(
        (w) => w.signingStatus === "SIGNED",
      );
      const signerRow = signedNow
        ? signingRequest.recipients.find((r) => r.email === signedNow.email)
        : null;
      if (signerRow) {
        await createTimelineRecord({
          projectId: signingRequest.projectId,
          userId: signerRow.userId,
          entityType: "document",
          entityId: signingRequest.id,
          entityName: signingRequest.title,
          action: "updated",
          metadata: { source: "documenso", event: "signed" },
        });
      }
      break;
    }

    case "DOCUMENT_COMPLETED": {
      // Idempotency: the synchronous /complete endpoint may have already saved
      // the signed document. Skip to avoid creating a duplicate project document.
      if (
        signingRequest.status === "completed" &&
        signingRequest.signedDocumentUrl
      ) {
        break;
      }

      // Download signed PDF, upload to blob storage, create project document record
      let signedDocumentUrl: string | undefined;
      if (signingRequest.envelopeId && signingRequest.userId) {
        try {
          const { url } = await persistSignedDocument(
            {
              projectId: signingRequest.projectId,
              envelopeId: signingRequest.envelopeId,
              title: signingRequest.title,
            },
            signingRequest.userId,
            docConfig,
          );
          signedDocumentUrl = url;
        } catch (error) {
          console.error("Failed to download/upload signed document:", error);
        }
      }

      const completedRecipients: SigningRecipientRow[] =
        signingRequest.recipients.map((r) =>
          r.role === "cc" || r.signingStatus === "signed"
            ? r
            : { ...r, signingStatus: "signed", signedAt: r.signedAt ?? now },
        );

      await updateSigningRequestStatus(signingRequest.id, "completed", {
        recipients: completedRecipients,
        signedDocumentUrl,
      });

      // CC recipients receive the signed copy (Documenso emails no one).
      void sendCcCopies({
        projectId: signingRequest.projectId,
        documentTitle: signingRequest.title,
        recipients: completedRecipients,
        signedDocumentUrl,
      });

      if (signingRequest.userId) {
        await createTimelineRecord({
          projectId: signingRequest.projectId,
          userId: signingRequest.userId,
          entityType: "document",
          entityId: signingRequest.id,
          entityName: signingRequest.title,
          action: "updated",
          metadata: { source: "documenso", event: "completed" },
        });
      }
      break;
    }

    case "DOCUMENT_REJECTED": {
      const rejectedRecipient = payload.recipients.find(
        (r) => r.signingStatus === "REJECTED",
      );
      const reason = rejectedRecipient?.rejectionReason ?? null;
      const updatedRecipients = signingRequest.recipients.map((r) => {
        if (r.email === rejectedRecipient?.email) {
          return {
            ...r,
            signingStatus: "rejected" as const,
            rejectionReason: reason ?? undefined,
          };
        }
        return r;
      });

      // One rejection halts the whole request — no further releases.
      await updateSigningRequestStatus(signingRequest.id, "rejected", {
        recipients: updatedRecipients,
      });

      const rejectedRow = signingRequest.recipients.find(
        (r) => r.email === rejectedRecipient?.email,
      );
      void notifyRejection({
        projectId: signingRequest.projectId,
        documentTitle: signingRequest.title,
        requesterEmail: signingRequest.requester.email,
        recipients: updatedRecipients,
        rejectedByName: rejectedRow?.name ?? "A signer",
        reason,
      });

      const rejectActorId = rejectedRow?.userId ?? signingRequest.userId;
      if (rejectActorId) {
        await createTimelineRecord({
          projectId: signingRequest.projectId,
          userId: rejectActorId,
          entityType: "document",
          entityId: signingRequest.id,
          entityName: signingRequest.title,
          action: "updated",
          metadata: { source: "documenso", event: "rejected", reason },
        });
      }
      break;
    }

    case "DOCUMENT_CANCELLED": {
      await updateSigningRequestStatus(signingRequest.id, "cancelled");

      if (signingRequest.userId) {
        await createTimelineRecord({
          projectId: signingRequest.projectId,
          userId: signingRequest.userId,
          entityType: "document",
          entityId: signingRequest.id,
          entityName: signingRequest.title,
          action: "deleted",
          metadata: { source: "documenso", event: "cancelled" },
        });
      }
      break;
    }
  }

  return c.json({ success: true });
});
