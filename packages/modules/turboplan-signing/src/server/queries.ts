import { and, desc, eq, sql } from "drizzle-orm";

import {
  type NewSigningRequest,
  office,
  officeUsers,
  organization,
  organizationUsers,
  profile,
  project,
  projectUsers,
  type SigningRecipientRow,
  type SigningRequestRow,
  signingRequest,
  user,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

// A recipient's `signingUrl` is a Documenso bearer token — whoever holds it can
// sign as that recipient directly on Documenso, bypassing app RBAC and the turn
// gate. It must never reach a client in a multi-recipient/list response; clients
// mint their own scoped token via the RBAC-gated GET /:id/sign-token. Server
// internals (webhook gate release, sign-token) read it from getSigningRequest,
// which is intentionally NOT stripped.
const withoutSigningUrl = (r: SigningRecipientRow): SigningRecipientRow => {
  const copy = { ...r };
  copy.signingUrl = undefined;
  return copy;
};

export const stripSigningUrls = <
  T extends { recipients: SigningRecipientRow[] },
>(
  request: T,
): T => ({ ...request, recipients: request.recipients.map(withoutSigningUrl) });

/**
 * Returns the set of user IDs with access to a project — direct project members
 * plus members inherited from the parent office and organization.
 *
 * This mirrors GET /api/projects/:id/members (the source the "Request
 * Signatures" dialog lists), so every member the dialog offers is also a valid
 * signing recipient. Validating against direct projectUsers alone would reject
 * inherited office/org members the UI legitimately shows.
 */
export const getProjectMemberUserIds = async (
  projectId: string,
): Promise<Set<string>> => {
  const [hierarchy] = await db
    .select({
      officeId: project.officeId,
      organizationId: office.organizationId,
    })
    .from(project)
    .innerJoin(office, eq(project.officeId, office.id))
    .where(eq(project.id, projectId))
    .limit(1);

  if (!hierarchy) {
    return new Set();
  }

  const [direct, officeMembers, orgMembers] = await Promise.all([
    db
      .select({ userId: projectUsers.userId })
      .from(projectUsers)
      .where(eq(projectUsers.projectId, projectId)),
    db
      .select({ userId: officeUsers.userId })
      .from(officeUsers)
      .where(eq(officeUsers.officeId, hierarchy.officeId)),
    db
      .select({ userId: organizationUsers.userId })
      .from(organizationUsers)
      .where(eq(organizationUsers.organizationId, hierarchy.organizationId)),
  ]);

  return new Set([
    ...direct.map((m) => m.userId),
    ...officeMembers.map((m) => m.userId),
    ...orgMembers.map((m) => m.userId),
  ]);
};

export type ProjectSlugs = {
  name: string;
  projectSlug: string;
  officeSlug: string;
  orgSlug: string;
};

// Resolves the org/office/project slugs used to build deep links into the app
// (signing page URLs in invite/CC emails). Shared by the router and webhook.
export const getProjectSlugs = async (
  projectId: string,
): Promise<ProjectSlugs | null> => {
  const [result] = await db
    .select({
      name: project.name,
      projectSlug: project.slug,
      officeSlug: office.slug,
      orgSlug: organization.slug,
    })
    .from(project)
    .innerJoin(office, eq(project.officeId, office.id))
    .innerJoin(organization, eq(office.organizationId, organization.id))
    .where(eq(project.id, projectId))
    .limit(1);
  return result ?? null;
};

type RequesterInfo = {
  id: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

type SigningRequestWithRequester = SigningRequestRow & {
  requester: RequesterInfo;
};

export const createSigningRequest = async (
  data: NewSigningRequest,
): Promise<SigningRequestRow> => {
  try {
    const [record] = await db.insert(signingRequest).values(data).returning();
    return record;
  } catch (error) {
    console.error("Failed to create signing request:", error);
    throw error;
  }
};

export const getSigningRequest = async (
  id: string,
): Promise<SigningRequestWithRequester | null> => {
  try {
    const results = await db
      .select({
        id: signingRequest.id,
        documentId: signingRequest.documentId,
        projectId: signingRequest.projectId,
        userId: signingRequest.userId,
        envelopeId: signingRequest.envelopeId,
        status: signingRequest.status,
        signingMode: signingRequest.signingMode,
        title: signingRequest.title,
        recipients: signingRequest.recipients,
        signedDocumentUrl: signingRequest.signedDocumentUrl,
        createdAt: signingRequest.createdAt,
        updatedAt: signingRequest.updatedAt,
        requester: {
          id: user.id,
          email: user.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
        },
      })
      .from(signingRequest)
      .leftJoin(user, eq(signingRequest.userId, user.id))
      .leftJoin(profile, eq(user.id, profile.userId))
      .where(eq(signingRequest.id, id))
      .limit(1);

    return results[0] ?? null;
  } catch (error) {
    console.error("Failed to get signing request:", error);
    throw error;
  }
};

export const getSigningRequestByEnvelopeId = async (
  envelopeId: string,
): Promise<SigningRequestRow | null> => {
  try {
    const [record] = await db
      .select()
      .from(signingRequest)
      .where(eq(signingRequest.envelopeId, envelopeId))
      .limit(1);
    return record ?? null;
  } catch (error) {
    console.error("Failed to get signing request by envelope ID:", error);
    throw error;
  }
};

export const getSigningRequestsByProjectId = async (
  projectId: string,
): Promise<SigningRequestWithRequester[]> => {
  try {
    const rows = await db
      .select({
        id: signingRequest.id,
        documentId: signingRequest.documentId,
        projectId: signingRequest.projectId,
        userId: signingRequest.userId,
        envelopeId: signingRequest.envelopeId,
        status: signingRequest.status,
        signingMode: signingRequest.signingMode,
        title: signingRequest.title,
        recipients: signingRequest.recipients,
        signedDocumentUrl: signingRequest.signedDocumentUrl,
        createdAt: signingRequest.createdAt,
        updatedAt: signingRequest.updatedAt,
        requester: {
          id: user.id,
          email: user.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
        },
      })
      .from(signingRequest)
      .leftJoin(user, eq(signingRequest.userId, user.id))
      .leftJoin(profile, eq(user.id, profile.userId))
      .where(eq(signingRequest.projectId, projectId))
      .orderBy(desc(signingRequest.createdAt));
    return rows.map(stripSigningUrls);
  } catch (error) {
    console.error("Failed to get signing requests by project:", error);
    throw error;
  }
};

export const getSigningRequestsByDocumentId = async (
  documentId: string,
): Promise<SigningRequestRow[]> => {
  try {
    return await db
      .select()
      .from(signingRequest)
      .where(eq(signingRequest.documentId, documentId))
      .orderBy(desc(signingRequest.createdAt));
  } catch (error) {
    console.error("Failed to get signing requests by document:", error);
    throw error;
  }
};

export type SigningRequestWithProject = SigningRequestRow & {
  projectName: string;
  projectSlug: string;
  officeSlug: string;
  orgSlug: string;
  requester: RequesterInfo;
};

export const getMyPendingSigningRequests = async (
  userId: string,
  organizationId?: string,
): Promise<SigningRequestWithProject[]> => {
  try {
    // Surface a request only when it is actually this user's turn: they must be
    // an invited (sendStatus=sent) signer who hasn't signed. This hides "not your
    // turn yet" sequential steps and never surfaces CC rows. Being present in the
    // recipients array is itself the authorization — no projectUsers join needed
    // (and joining it would wrongly exclude office/org-inherited recipients).
    const conditions = [
      eq(signingRequest.status, "pending"),
      sql`${signingRequest.recipients}::jsonb @> ${JSON.stringify([
        {
          userId,
          role: "signer",
          sendStatus: "sent",
          signingStatus: "not_signed",
        },
      ])}::jsonb`,
    ];

    if (organizationId) {
      conditions.push(eq(office.organizationId, organizationId));
    }

    const rows = await db
      .select({
        id: signingRequest.id,
        documentId: signingRequest.documentId,
        projectId: signingRequest.projectId,
        userId: signingRequest.userId,
        envelopeId: signingRequest.envelopeId,
        status: signingRequest.status,
        signingMode: signingRequest.signingMode,
        title: signingRequest.title,
        recipients: signingRequest.recipients,
        signedDocumentUrl: signingRequest.signedDocumentUrl,
        createdAt: signingRequest.createdAt,
        updatedAt: signingRequest.updatedAt,
        projectName: project.name,
        projectSlug: project.slug,
        officeSlug: office.slug,
        orgSlug: organization.slug,
        requester: {
          id: user.id,
          email: user.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
        },
      })
      .from(signingRequest)
      .innerJoin(project, eq(signingRequest.projectId, project.id))
      .innerJoin(office, eq(project.officeId, office.id))
      .innerJoin(organization, eq(office.organizationId, organization.id))
      .leftJoin(user, eq(signingRequest.userId, user.id))
      .leftJoin(profile, eq(user.id, profile.userId))
      .where(and(...conditions))
      .orderBy(desc(signingRequest.createdAt));
    return rows.map(stripSigningUrls);
  } catch (error) {
    console.error("Failed to get pending signing requests:", error);
    throw error;
  }
};

export const updateSigningRequestStatus = async (
  id: string,
  status: SigningRequestRow["status"],
  updates?: {
    recipients?: SigningRecipientRow[];
    signedDocumentUrl?: string;
    envelopeId?: string;
  },
): Promise<SigningRequestRow | null> => {
  try {
    const [record] = await db
      .update(signingRequest)
      .set({
        status,
        updatedAt: new Date(),
        ...(updates?.recipients && { recipients: updates.recipients }),
        ...(updates?.signedDocumentUrl && {
          signedDocumentUrl: updates.signedDocumentUrl,
        }),
        ...(updates?.envelopeId && { envelopeId: updates.envelopeId }),
      })
      .where(eq(signingRequest.id, id))
      .returning();
    return record ?? null;
  } catch (error) {
    console.error("Failed to update signing request status:", error);
    throw error;
  }
};
