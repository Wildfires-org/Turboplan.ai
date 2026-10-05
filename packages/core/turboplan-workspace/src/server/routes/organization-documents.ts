/**
 * Organization Documents API routes
 *
 * Reference documents (PDF, Word) an organization shares with the AI:
 * - GET /api/organization-documents?organizationId=xxx - List an organization's documents
 * - GET /api/organization-documents/:id/text - Extracted text + extraction status
 * - POST /api/organization-documents - Create a document record after upload to R2
 * - PATCH /api/organization-documents/:id - Rename (display name only) and/or pin
 * - DELETE /api/organization-documents/:id - Delete a document and its stored file
 *
 * Reading needs organization READ, every change organization UPDATE (owner or
 * editor). Routes keyed by a document id answer a malformed or unknown id
 * with the same 403 as a denial, so document ids cannot be probed.
 */

import { type Context, Hono } from "hono";
import { z } from "zod";

import {
  countOrganizationDocuments,
  createOrganizationDocument,
  getOrganizationDocumentById,
  getOrganizationDocumentTextsByIds,
  listOrganizationDocuments,
  updateOrganizationDocument,
} from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  getRBACServiceForRequest,
  type RBACContext,
  requireEntityPermission,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import { isOwnedUploadUrl } from "@wildfires-org/turboplan-upload/server";

import { ORGANIZATION_DOCUMENTS_MAX } from "../../types";
import { normalizeRenamedFilename } from "../documents/validation";
import {
  createOrganizationDocumentSchema,
  updateOrganizationDocumentSchema,
} from "../organizations/context-validation";
import { removeOrganizationDocument } from "../organizations/documents";
import { toDocumentTextResponse } from "../projects/document-text";

const uuidSchema = z.string().uuid();

/** The `organizationId` query param, or null (→ 400) when absent or malformed. */
const organizationIdFromQuery = (c: Context<RBACContext>): string | null => {
  const parseResult = uuidSchema.safeParse(c.req.query("organizationId"));
  return parseResult.success ? parseResult.data : null;
};

/**
 * The organization owning the document in the `:id` param, or null (→ the
 * guard's uniform 403) when the id is malformed or matches no document.
 */
const organizationIdFromDocument = async (
  c: Context<RBACContext>,
): Promise<string | null> => {
  const parseResult = uuidSchema.safeParse(c.req.param("id"));
  if (!parseResult.success) {
    return null;
  }

  const document = await getOrganizationDocumentById(parseResult.data);
  return document?.organizationId ?? null;
};

export const organizationDocumentsRouter = new Hono<RBACContext>();

/**
 * GET / - List an organization's documents (newest first, without text)
 * Query params:
 * - organizationId (required): The organization to list documents for
 */
organizationDocumentsRouter.get(
  "/",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.READ,
    organizationIdFromQuery,
  ),
  async (c) => {
    try {
      // Validated by the guard
      const organizationId = c.req.query("organizationId") as string;
      const documents = await listOrganizationDocuments(organizationId);

      return c.json({ documents });
    } catch (error) {
      console.error("Failed to get organization documents:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

/**
 * GET /:id/text - The document's extracted text, for the preview
 *
 * Returns `{ status, text, error }` (see `toDocumentTextResponse`); `text` is
 * the stored extraction, already capped at 40k characters.
 */
organizationDocumentsRouter.get(
  "/:id/text",
  requireEntityPermission(
    EntityType.ORGANIZATION,
    Action.READ,
    organizationIdFromDocument,
  ),
  async (c) => {
    try {
      const document = await getOrganizationDocumentById(
        c.req.param("id") as string,
      );
      if (!document) {
        return c.json({ error: "Document not found" }, 404);
      }

      const [textRow] = await getOrganizationDocumentTextsByIds(
        document.organizationId,
        [document.id],
      );

      // Per-user authorization decides who may see this text: never let a
      // shared cache keep it.
      c.header("Cache-Control", "private, no-store");
      return c.json(
        toDocumentTextResponse({
          ...document,
          extractedText: textRow?.extractedText ?? null,
        }),
      );
    } catch (error) {
      console.error("Failed to get organization document text:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

/**
 * POST / - Create a document record after upload to R2
 * Body:
 * - organizationId: UUID of the organization
 * - filename: Sanitized filename used in storage
 * - originalFilename: Original filename from user (the display name)
 * - mimeType: MIME type of the file (PDF / Word)
 * - size: File size in bytes
 * - url: R2 storage URL
 *
 * Requires UPDATE permission on the organization (owner/editor). The row
 * starts with extraction "pending"; the extraction worker picks it up.
 */
organizationDocumentsRouter.post("/", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const validationResult = createOrganizationDocumentSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const { organizationId, filename, originalFilename, mimeType, size, url } =
      validationResult.data;

    // The registered URL must be an object THIS user uploaded (their own
    // `uploads/{userId}/` prefix), not merely any URL in our bucket. Otherwise
    // an editor could register another tenant's blob — making it downloadable
    // through the organization and deletable via the DELETE route below (IDOR).
    if (!isOwnedUploadUrl(url, user.userId)) {
      return c.json({ error: "File URL must reference your own upload" }, 400);
    }

    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      organizationId,
      EntityType.ORGANIZATION,
      Action.UPDATE,
      { email: user.email },
    );

    if (!permissionResult.allowed) {
      return c.json(
        { error: "Forbidden", reason: permissionResult.reason },
        403,
      );
    }

    // Soft cap: two concurrent uploads at the limit can both pass this check.
    const documentCount = await countOrganizationDocuments(organizationId);
    if (documentCount >= ORGANIZATION_DOCUMENTS_MAX) {
      return c.json(
        {
          error: `Organizations can hold up to ${ORGANIZATION_DOCUMENTS_MAX} documents. Delete unused documents first.`,
          code: "ORGANIZATION_DOCUMENTS_LIMIT_REACHED",
        },
        409,
      );
    }

    const newDocument = await createOrganizationDocument({
      organizationId,
      filename,
      originalFilename,
      mimeType,
      size,
      url,
      uploadedBy: user.userId,
    });

    return c.json(newDocument, 201);
  } catch (error) {
    console.error("Failed to create organization document:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * PATCH /:id - Rename (display name only) and/or pin a document
 *
 * Body (at least one field):
 * - originalFilename: New display name (1-255 chars, trimmed). The extension is
 *   forced to match the existing document's — a supplied extension that differs
 *   or is missing gets replaced with the original one.
 * - isPinned: Pinned documents go first into the AI context budget
 *
 * Storage fields (filename, url) are never touched. Requires UPDATE on the
 * document's organization.
 */
organizationDocumentsRouter.patch(
  "/:id",
  requireEntityPermission(
    EntityType.ORGANIZATION,
    Action.UPDATE,
    organizationIdFromDocument,
  ),
  async (c) => {
    try {
      const documentId = c.req.param("id") as string;

      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
      }

      const validationResult = updateOrganizationDocumentSchema.safeParse(body);
      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const { originalFilename, isPinned } = validationResult.data;

      const existingDocument = await getOrganizationDocumentById(documentId);
      if (!existingDocument) {
        return c.json({ error: "Document not found" }, 404);
      }

      let normalizedFilename: string | undefined;
      if (originalFilename !== undefined) {
        const renamed = normalizeRenamedFilename(
          originalFilename,
          existingDocument.originalFilename,
        );
        if ("error" in renamed) {
          return c.json({ error: renamed.error }, 400);
        }
        normalizedFilename = renamed.filename;
      }

      const updatedDocument = await updateOrganizationDocument(documentId, {
        originalFilename: normalizedFilename,
        isPinned,
      });

      if (!updatedDocument) {
        return c.json({ error: "Document not found" }, 404);
      }

      return c.json(updatedDocument);
    } catch (error) {
      console.error("Failed to update organization document:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

/**
 * DELETE /:id - Delete a document and (when safe) its stored file
 *
 * Requires UPDATE on the document's organization.
 */
organizationDocumentsRouter.delete(
  "/:id",
  requireEntityPermission(
    EntityType.ORGANIZATION,
    Action.UPDATE,
    organizationIdFromDocument,
  ),
  async (c) => {
    try {
      const existingDocument = await getOrganizationDocumentById(
        c.req.param("id") as string,
      );
      if (!existingDocument) {
        return c.json({ error: "Document not found" }, 404);
      }

      // Row first, then the stored object only if it belongs to the row's
      // uploader and no other document row still references it.
      await removeOrganizationDocument(existingDocument);

      return c.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Failed to delete organization document:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);
