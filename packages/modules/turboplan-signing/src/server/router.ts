import { desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";

import {
  document,
  profile,
  projectUsers,
  type SigningRecipientRow,
  user,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";

import { resolveDocumensoConfig } from "./config-resolver";
import {
  cancelEnvelope,
  createEnvelope,
  extractSigningToken,
  getDocumensoHost,
  getEnvelopeStatus,
} from "./documenso-client";
import { sendCcCopies, sendInviteEmails } from "./notify";
import { generatePdfFromMarkdown } from "./pdf-generator";
import { persistSignedDocument } from "./persist";
import {
  createSigningRequest,
  getMyPendingSigningRequests,
  getProjectMemberUserIds,
  getSigningRequest,
  getSigningRequestsByDocumentId,
  getSigningRequestsByProjectId,
  updateSigningRequestStatus,
} from "./queries";
import {
  applyEnvelopeSync,
  buildOrderedRecipients,
  requesterDisplayName,
} from "./recipient-sync";
import {
  getAuditContext,
  isDocumentInProject,
  isRequesterOrRecipient,
  sanitizeRequest,
} from "./request-access";
import {
  cancelSigningSchema,
  completeSigningSchema,
  createSigningRequestSchema,
} from "./schemas";

export const signingRouter = new Hono<RBACContext>();

// POST / — Create signing request
signingRouter.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createSigningRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.issues },
      400,
    );
  }

  const {
    documentId,
    projectId,
    recipients,
    signingMode,
    requesterSigns,
    title,
  } = parsed.data;
  const userId = c.get("user").userId;

  // Inline RBAC check
  const permCheck = requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    () => projectId,
  );
  const permResult = await permCheck(c, async () => {});
  if (permResult) {
    return permResult;
  }

  // Resolve final ordered recipient set: requester is injected as a signer at
  // the requested position; `order` is assigned per signing mode.
  const ordered = buildOrderedRecipients(
    recipients,
    userId,
    requesterSigns,
    signingMode,
  );

  if (ordered.length === 0 || !ordered.some((r) => r.role === "signer")) {
    return c.json({ error: "At least one signer is required" }, 400);
  }

  // Fetch latest document version
  const [doc] = await db
    .select({
      id: document.id,
      title: document.title,
      content: document.content,
      chatId: document.chatId,
    })
    .from(document)
    .where(eq(document.id, documentId))
    .orderBy(desc(document.createdAt))
    .limit(1);

  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  if (!doc.content) {
    return c.json({ error: "Document has no content" }, 400);
  }

  // Verify document belongs to project (via its chat). Unbound documents are
  // rejected — never rendered into an envelope under an unrelated project.
  if (!(await isDocumentInProject(doc.chatId, projectId))) {
    return c.json({ error: "Document does not belong to project" }, 403);
  }

  // Verify recipients are project members and get their details. Membership
  // includes office/org-inherited members so the recipient set matches what the
  // "Request Signatures" dialog lists (GET /api/projects/:id/members) — not just
  // direct projectUsers, which would wrongly reject inherited members. The
  // requester is implicitly a member (they hold UPDATE on the project), so only
  // the other recipients are checked.
  const orderedUserIds = ordered.map((r) => r.userId);
  const [memberIds, userDetails] = await Promise.all([
    getProjectMemberUserIds(projectId),
    db
      .select({
        id: user.id,
        email: user.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
      })
      .from(user)
      .leftJoin(profile, eq(user.id, profile.userId))
      .where(inArray(user.id, orderedUserIds)),
  ]);

  const nonMembers = orderedUserIds.filter(
    (id) => id !== userId && !memberIds.has(id),
  );
  if (nonMembers.length > 0) {
    return c.json(
      { error: "Some recipients are not project members", nonMembers },
      400,
    );
  }

  const detailsById = new Map(userDetails.map((u) => [u.id, u]));
  const displayName = (u: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  }) => [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;

  // Build recipient rows. sendStatus gates who is invited now: parallel invites
  // everyone; sequential invites only step 1 and releases the rest on each sign.
  const recipientRows: SigningRecipientRow[] = [];
  for (const r of ordered) {
    const u = detailsById.get(r.userId);
    if (!u) {
      return c.json(
        { error: "Recipient user not found", userId: r.userId },
        400,
      );
    }
    const sent = signingMode === "parallel" || r.order === 1;
    recipientRows.push({
      userId: r.userId,
      email: u.email,
      name: displayName(u),
      role: r.role,
      order: r.order,
      sendStatus: sent ? "sent" : "not_sent",
      readStatus: "not_opened",
      signingStatus: "not_signed",
    });
  }

  // Create signing request record first (draft)
  const signingRequestTitle = title || doc.title;
  const record = await createSigningRequest({
    documentId,
    projectId,
    userId,
    status: "draft",
    signingMode,
    title: signingRequestTitle,
    recipients: recipientRows,
  });

  try {
    // Resolve org-level Documenso config (or fall back to env vars)
    const docConfig = await resolveDocumensoConfig(projectId);

    // Generate PDF from markdown
    const pdf = await generatePdfFromMarkdown(doc.content, signingRequestTitle);

    // Create Documenso envelope with our signing request ID as external reference
    const envelope = await createEnvelope(
      pdf,
      signingRequestTitle,
      recipientRows.map((r) => ({
        email: r.email,
        name: r.name,
        role: r.role,
        order: r.order,
      })),
      record.id,
      { signingMode, config: docConfig },
    );

    // Store signing URLs per recipient (tokens are minted for everyone upfront;
    // sequential simply withholds the email until a recipient's turn).
    const recipientsWithUrls = recipientRows.map((r) => {
      const envelopeRecipient = envelope.recipients.find(
        (er) => er.email === r.email,
      );
      return { ...r, signingUrl: envelopeRecipient?.signingUrl };
    });

    // Update signing request with envelope ID, signing URLs, and pending status
    const updated = await updateSigningRequestStatus(record.id, "pending", {
      envelopeId: envelope.envelopeId,
      recipients: recipientsWithUrls,
    });

    const audit = getAuditContext(c);
    await createTimelineRecord({
      projectId,
      userId,
      entityType: "document",
      entityId: record.id,
      entityName: signingRequestTitle,
      action: "created",
      metadata: {
        source: "signing",
        event: "invited",
        signingMode,
        ip: audit.ip,
        userAgent: audit.userAgent,
      },
    });

    // Email the invited signers (sendStatus=sent), excluding the requester (who
    // signs in-session) and CC recipients (notified with the signed copy on
    // completion). Fire-and-forget.
    const requester = detailsById.get(userId);
    const requesterName = requester ? displayName(requester) : "A team member";
    const toInvite = recipientsWithUrls.filter(
      (r) =>
        r.userId !== userId && r.role === "signer" && r.sendStatus === "sent",
    );
    void sendInviteEmails(
      projectId,
      toInvite,
      requesterName,
      signingRequestTitle,
    );

    // When the requester signs first, hand back an inline token so the client
    // opens the embedded modal in-session (this replaces the old /sign route).
    let inline: {
      signingToken: string;
      signingRequestId: string;
      host: string;
    } | null = null;
    if (requesterSigns === "first") {
      const requesterRow = recipientsWithUrls.find((r) => r.userId === userId);
      if (requesterRow?.signingUrl && requesterRow.role === "signer") {
        inline = {
          signingToken: extractSigningToken(requesterRow.signingUrl),
          signingRequestId: record.id,
          host: getDocumensoHost(docConfig),
        };
      }
    }

    return c.json({ signingRequest: sanitizeRequest(updated), inline }, 201);
  } catch (error) {
    // Mark as failed if envelope creation fails
    await updateSigningRequestStatus(record.id, "cancelled");
    throw error;
  }
});

// GET /:id/sign-token — Mint an in-session signing token for the current user's
// recipient row on an existing request. Replaces the old self-sign route: signing
// reuses the token Documenso minted at creation instead of creating a fresh
// envelope, and enforces the sequential turn gate (sendStatus).
signingRouter.get("/:id/sign-token", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("user").userId;

  const record = await getSigningRequest(id);
  if (!record) {
    return c.json({ error: "Signing request not found" }, 404);
  }

  // RBAC — project member (READ)...
  const permCheck = requirePermission(
    EntityType.PROJECT,
    Action.READ,
    () => record.projectId,
  );
  const permResult = await permCheck(c, async () => {});
  if (permResult) {
    return permResult;
  }
  // ...and the requester or a recipient.
  if (!isRequesterOrRecipient(record, userId)) {
    return c.json({ error: "Access denied" }, 403);
  }

  if (record.status !== "pending") {
    return c.json({ error: `Signing request is ${record.status}` }, 409);
  }

  const docConfig = await resolveDocumensoConfig(record.projectId);

  // Reconcile against Documenso before deciding. If the signer already signed
  // there (e.g. on a prior attempt) our DB may still show them unsigned, which
  // would hand back a token to an already-finished document — a dead end where
  // the embed reports "already signed" and nothing ever advances. Syncing here
  // records the signature and releases the next signer without the webhook.
  if (record.envelopeId) {
    const envelopeStatus = await getEnvelopeStatus(
      record.envelopeId,
      docConfig,
    );
    const { recipients, released } = applyEnvelopeSync(
      record,
      envelopeStatus.recipients,
      new Date().toISOString(),
    );
    if (JSON.stringify(recipients) !== JSON.stringify(record.recipients)) {
      await updateSigningRequestStatus(record.id, "pending", { recipients });
      if (released) {
        void sendInviteEmails(
          record.projectId,
          [released],
          requesterDisplayName(record.requester),
          record.title,
        );
      }
      record.recipients = recipients;
    }
  }

  const recipient = record.recipients.find((r) => r.userId === userId);
  if (!recipient || recipient.role === "cc") {
    return c.json({ error: "You are not a signer on this request" }, 403);
  }
  if (recipient.signingStatus === "signed") {
    return c.json({ error: "You have already signed" }, 409);
  }
  if (recipient.signingStatus === "rejected") {
    return c.json({ error: "This request was rejected" }, 409);
  }
  // Sequential gate: a recipient can't sign until released (sendStatus=sent).
  if (recipient.sendStatus !== "sent") {
    return c.json({ error: "It is not your turn to sign yet" }, 409);
  }
  if (!recipient.signingUrl) {
    return c.json({ error: "No signing token available" }, 400);
  }

  return c.json({
    signingToken: extractSigningToken(recipient.signingUrl),
    signingRequestId: record.id,
    host: getDocumensoHost(docConfig),
  });
});

// POST /complete — Complete signing: download signed PDF and store as project document
signingRouter.post("/complete", async (c) => {
  const body = await c.req.json();
  const parsed = completeSigningSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.issues },
      400,
    );
  }

  const { signingRequestId } = parsed.data;
  const userId = c.get("user").userId;

  // Fetch signing request
  const record = await getSigningRequest(signingRequestId);
  if (!record) {
    return c.json({ error: "Signing request not found" }, 404);
  }

  // Idempotency: the DOCUMENT_COMPLETED webhook may have already saved the
  // signed document. Don't download/store a duplicate.
  if (record.status === "completed") {
    return c.json({ signingRequest: sanitizeRequest(record) });
  }

  // Only complete pending requests
  if (record.status !== "pending") {
    return c.json(
      { error: `Signing request is already ${record.status}` },
      400,
    );
  }

  if (!record.envelopeId) {
    return c.json({ error: "Signing request has no envelope" }, 400);
  }

  // RBAC check — must be a project member (READ)...
  const permCheck = requirePermission(
    EntityType.PROJECT,
    Action.READ,
    () => record.projectId,
  );
  const permResult = await permCheck(c, async () => {});
  if (permResult) {
    return permResult;
  }

  // ...and the actor must be the requester or one of the recipients. Prevents an
  // unrelated project member from driving completion of someone else's request.
  if (!isRequesterOrRecipient(record, userId)) {
    return c.json({ error: "Access denied" }, 403);
  }

  // Resolve org-level Documenso config
  const docConfig = await resolveDocumensoConfig(record.projectId);

  // The envelope only reaches COMPLETED once EVERY signer has signed. When this
  // caller is the last signer, Documenso transitions to COMPLETED and then seals
  // the PDF asynchronously, so we poll briefly to bridge the sealing gap. When
  // other signers remain, the envelope stays PENDING — that's not an error: we
  // sync this signer's status from Documenso and release the next one below. The
  // DOCUMENT_SIGNED / DOCUMENT_COMPLETED webhooks remain the durable fallback.
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  const maxAttempts = 8;
  let sealed = false;
  let lastStatus: Awaited<ReturnType<typeof getEnvelopeStatus>> | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    lastStatus = await getEnvelopeStatus(record.envelopeId, docConfig);
    if (lastStatus.status === "COMPLETED") {
      sealed = true;
      break;
    }
    if (lastStatus.status === "REJECTED") {
      return c.json({ error: "Document was rejected" }, 409);
    }
    if (lastStatus.status === "PENDING") {
      // Other signers still pending — nothing to seal yet.
      break;
    }
    await sleep(1000);
  }

  if (!sealed) {
    // Other signers remain. Record the caller's signature (and any others) from
    // Documenso — the source of truth — and advance the sequential gate here,
    // synchronously. The DOCUMENT_SIGNED webhook is the durable, idempotent
    // fallback, but relying on it alone leaves the signature unrecorded until it
    // lands (and it can't reach localhost in dev). Request stays pending.
    const { recipients: recipientsToPersist, released } = applyEnvelopeSync(
      record,
      lastStatus?.recipients ?? [],
      new Date().toISOString(),
    );
    if (released) {
      void sendInviteEmails(
        record.projectId,
        [released],
        requesterDisplayName(record.requester),
        record.title,
      );
    }
    const updated = await updateSigningRequestStatus(record.id, "pending", {
      recipients: recipientsToPersist,
    });
    return c.json({ signingRequest: sanitizeRequest(updated), pending: true });
  }

  // Download the signed PDF, upload to blob storage, create the project document.
  const { url, originalFilename } = await persistSignedDocument(
    {
      projectId: record.projectId,
      envelopeId: record.envelopeId,
      title: record.title,
    },
    userId,
    docConfig,
  );

  // Envelope COMPLETED ⇒ every signer signed. Mark any not-yet-recorded signers
  // as signed (the webhook may not have landed yet) and stamp signedAt.
  const signedAt = new Date().toISOString();
  const completedRecipients: SigningRecipientRow[] = record.recipients.map(
    (r) =>
      r.role === "cc" || r.signingStatus === "signed"
        ? r
        : { ...r, signingStatus: "signed", signedAt: r.signedAt ?? signedAt },
  );

  // Update signing request status to completed with the signed document URL
  const updated = await updateSigningRequestStatus(record.id, "completed", {
    signedDocumentUrl: url,
    recipients: completedRecipients,
  });

  // CC recipients get the signed copy now (Documenso sends nothing — see notify).
  void sendCcCopies({
    projectId: record.projectId,
    documentTitle: record.title,
    recipients: completedRecipients,
    signedDocumentUrl: url,
  });

  const audit = getAuditContext(c);
  await createTimelineRecord({
    projectId: record.projectId,
    userId,
    entityType: "document",
    entityId: record.id,
    entityName: record.title,
    action: "updated",
    resourceUrls: [
      {
        url,
        filename: originalFilename,
        type: "application/pdf",
      },
    ],
    metadata: {
      source: "signing",
      event: "completed",
      ip: audit.ip,
      userAgent: audit.userAgent,
    },
  });

  return c.json({ signingRequest: sanitizeRequest(updated) });
});

// POST /cancel — Abandon a pending signing request (void the envelope)
signingRouter.post("/cancel", async (c) => {
  const body = await c.req.json();
  const parsed = cancelSigningSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.issues },
      400,
    );
  }

  const { signingRequestId } = parsed.data;

  const record = await getSigningRequest(signingRequestId);
  if (!record) {
    return c.json({ error: "Signing request not found" }, 404);
  }

  // Only pending requests can be abandoned. Don't touch completed/rejected ones.
  if (record.status !== "pending") {
    return c.json({ signingRequest: sanitizeRequest(record) });
  }

  // RBAC check — must be a project member (READ)...
  const permCheck = requirePermission(
    EntityType.PROJECT,
    Action.READ,
    () => record.projectId,
  );
  const permResult = await permCheck(c, async () => {});
  if (permResult) {
    return permResult;
  }

  // ...and only the requester or a recipient may abandon the request. Cancelling
  // voids the envelope, so an unrelated member must not be able to trigger it.
  if (!isRequesterOrRecipient(record, c.get("user").userId)) {
    return c.json({ error: "Access denied" }, 403);
  }

  // Void the Documenso envelope so it doesn't linger as a pending document.
  if (record.envelopeId) {
    try {
      const docConfig = await resolveDocumensoConfig(record.projectId);
      await cancelEnvelope(record.envelopeId, docConfig);
    } catch (error) {
      console.error("Failed to void Documenso envelope on cancel:", error);
    }
  }

  const updated = await updateSigningRequestStatus(record.id, "cancelled");
  return c.json({ signingRequest: sanitizeRequest(updated) });
});

// GET / — List signing requests for project
signingRouter.get("/", async (c) => {
  const projectId = c.req.query("projectId");
  if (!projectId) {
    return c.json({ error: "projectId query parameter required" }, 400);
  }

  const permCheck = requirePermission(
    EntityType.PROJECT,
    Action.READ,
    () => projectId,
  );
  const permResult = await permCheck(c, async () => {});
  if (permResult) {
    return permResult;
  }

  const requests = await getSigningRequestsByProjectId(projectId);
  return c.json({ signingRequests: requests });
});

// GET /for-document/:documentId — Get current user's pending signing request for a document
signingRouter.get("/for-document/:documentId", async (c) => {
  const documentId = c.req.param("documentId");
  const userId = c.get("user").userId;

  const requests = await getSigningRequestsByDocumentId(documentId);

  // Find a pending request where it is currently this user's turn: an unsigned
  // signer who has been released (sendStatus=sent). Gating on sendStatus hides
  // the prompt for sequential steps that aren't this user's turn yet.
  for (const request of requests) {
    if (request.status !== "pending") {
      continue;
    }
    const recipient = request.recipients.find(
      (r) =>
        r.userId === userId &&
        r.role === "signer" &&
        r.signingStatus === "not_signed" &&
        r.sendStatus === "sent",
    );
    if (!recipient) {
      continue;
    }

    // The signingUrl is a Documenso bearer token (anyone holding it can sign as
    // this recipient). Only return it to a current member of the request's
    // project — not to someone who has since been removed. Uses inherited
    // membership so office/org-level recipients aren't wrongly excluded.
    const memberIds = await getProjectMemberUserIds(request.projectId);
    if (!memberIds.has(userId)) {
      continue;
    }

    return c.json({
      signingRequest: {
        id: request.id,
        title: request.title,
        status: request.status,
        signingUrl: recipient.signingUrl ?? null,
      },
    });
  }

  return c.json({ signingRequest: null });
});

// GET /my-pending — List current user's pending signing requests across projects
signingRouter.get("/my-pending", async (c) => {
  const userId = c.get("user").userId;
  const organizationId = c.req.query("organizationId");

  const requests = await getMyPendingSigningRequests(
    userId,
    organizationId ?? undefined,
  );
  return c.json({ signingRequests: requests });
});

// GET /:id — Get signing request details
signingRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const record = await getSigningRequest(id);

  if (!record) {
    return c.json({ error: "Signing request not found" }, 404);
  }

  // Manual RBAC check since we need to fetch the record first
  const userId = c.get("user").userId;
  const members = await db
    .select({ userId: projectUsers.userId })
    .from(projectUsers)
    .where(eq(projectUsers.projectId, record.projectId));

  if (!members.some((m) => m.userId === userId)) {
    return c.json({ error: "Access denied" }, 403);
  }

  return c.json({ signingRequest: sanitizeRequest(record) });
});

// GET /:id/status — Poll latest status from Documenso
signingRouter.get("/:id/status", async (c) => {
  const id = c.req.param("id");
  const record = await getSigningRequest(id);

  if (!record) {
    return c.json({ error: "Signing request not found" }, 404);
  }

  const userId = c.get("user").userId;
  const members = await db
    .select({ userId: projectUsers.userId })
    .from(projectUsers)
    .where(eq(projectUsers.projectId, record.projectId));

  if (!members.some((m) => m.userId === userId)) {
    return c.json({ error: "Access denied" }, 403);
  }

  if (!record.envelopeId) {
    return c.json({ signingRequest: sanitizeRequest(record) });
  }

  // Poll Documenso for latest status
  const docConfig = await resolveDocumensoConfig(record.projectId);
  const envelopeStatus = await getEnvelopeStatus(record.envelopeId, docConfig);

  // Map Documenso status to our status
  const statusMap: Record<string, "pending" | "completed" | "rejected"> = {
    PENDING: "pending",
    COMPLETED: "completed",
    REJECTED: "rejected",
  };
  const newStatus = statusMap[envelopeStatus.status] || record.status;

  // Update recipient statuses
  const updatedRecipients = record.recipients.map((r) => {
    const docRecipient = envelopeStatus.recipients.find(
      (dr) => dr.email === r.email,
    );
    if (!docRecipient) {
      return r;
    }
    const signingStatusMap: Record<
      string,
      "not_signed" | "signed" | "rejected"
    > = {
      NOT_SIGNED: "not_signed",
      SIGNED: "signed",
      REJECTED: "rejected",
    };
    return {
      ...r,
      signingStatus:
        signingStatusMap[docRecipient.signingStatus] || r.signingStatus,
    };
  });

  // Update if status changed
  if (newStatus !== record.status) {
    await updateSigningRequestStatus(record.id, newStatus, {
      recipients: updatedRecipients,
    });
  }

  const updated = await getSigningRequest(id);
  return c.json({ signingRequest: sanitizeRequest(updated) });
});
