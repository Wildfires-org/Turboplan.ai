/**
 * Project Documents API routes
 *
 * Endpoints for managing uploaded documents (PDFs, DOCX, etc.) in projects:
 * - GET /api/project-documents?projectId=xxx - List all documents for a project
 * - GET /api/project-documents/:id/text - Extracted text + extraction status
 * - POST /api/project-documents - Create a document record after upload to R2
 * - PATCH /api/project-documents/:id - Rename a document (display name only)
 * - DELETE /api/project-documents/:id - Delete a document
 */

import { Hono } from "hono";
import { z } from "zod";

import {
  createProjectDocument,
  getProjectDocumentById,
  getProjectDocumentsByProjectId,
  updateProjectDocument,
} from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  getRBACServiceForRequest,
  isPublicGovProjectReadAllowed,
  type RBACContext,
} from "@wildfires-org/turboplan-rbac/hono";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";
import { isOwnedUploadUrl } from "@wildfires-org/turboplan-upload/server";

import {
  documentDisplayNameSchema,
  normalizeRenamedFilename,
  uploadedDocumentFieldsSchema,
} from "../documents/validation";
import { toDocumentTextResponse } from "../projects/document-text";
import { removeProjectDocument } from "../projects/documents";

// Zod validation schemas
const createDocumentSchema = uploadedDocumentFieldsSchema.extend({
  projectId: z.string().uuid("Invalid project ID"),
});

const renameDocumentSchema = z.object({
  originalFilename: documentDisplayNameSchema,
});

export const projectDocumentsRouter = new Hono<RBACContext>();

/**
 * GET / - List documents for a project
 * Query params:
 * - projectId (required): The project to get documents for
 * - source (optional): Filter by origin — "upload" (Documents page) or
 *   "research" (Context page). Omit to return all documents (members) or
 *   only uploads (public-government readers without a project role).
 */
projectDocumentsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const projectId = c.req.query("projectId");
    const sourceParam = c.req.query("source");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!projectId) {
      return c.json({ error: "projectId is required" }, 400);
    }

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const parseResult = uuidSchema.safeParse(projectId);
    if (!parseResult.success) {
      return c.json({ error: "Invalid projectId format" }, 400);
    }

    // Validate optional source filter
    const sourceResult = z
      .enum(["upload", "research"])
      .optional()
      .safeParse(sourceParam);
    if (!sourceResult.success) {
      return c.json({ error: "Invalid source filter" }, 400);
    }

    // Check if user has READ permission on the project, with a fallback that
    // allows any authenticated user to read documents from public government
    // projects (matching the main project READ endpoint's bypass).
    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      projectId,
      EntityType.PROJECT,
      Action.READ,
    );

    // Research docs belong to the "context" module, uploads to "documents".
    // Public-government readers must pass that module's visibility check, and
    // without an explicit source they only get uploads (members get all).
    let source = sourceResult.data;
    if (!permissionResult.allowed) {
      source = source ?? "upload";
      const allowedAsPublic = await isPublicGovProjectReadAllowed(projectId, {
        moduleName: source === "research" ? "context" : "documents",
      });
      if (!allowedAsPublic) {
        return c.json(
          { error: "Forbidden", reason: permissionResult.reason },
          403,
        );
      }
    }

    const documents = await getProjectDocumentsByProjectId(projectId, source);

    return c.json(documents);
  } catch (error) {
    console.error("Failed to get project documents:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * GET /:id/text - The document's extracted text, for the preview
 *
 * Returns `{ status, text, error }` (see `toDocumentTextResponse`); `text` is
 * the stored extraction, already capped at 40k characters. Same read access as
 * the list: READ on the document's project, or — for public government
 * projects — the visibility check of the module the document belongs to.
 */
projectDocumentsRouter.get("/:id/text", async (c) => {
  try {
    const user = c.get("user");
    const documentId = c.req.param("id");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const parseResult = z.string().uuid().safeParse(documentId);
    if (!parseResult.success) {
      return c.json({ error: "Invalid document ID format" }, 400);
    }

    const document = await getProjectDocumentById(documentId);
    if (!document) {
      return c.json({ error: "Document not found" }, 404);
    }

    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      document.projectId,
      EntityType.PROJECT,
      Action.READ,
    );

    if (!permissionResult.allowed) {
      const allowedAsPublic = await isPublicGovProjectReadAllowed(
        document.projectId,
        {
          moduleName: document.source === "research" ? "context" : "documents",
        },
      );
      if (!allowedAsPublic) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }

    // Per-user authorization decides who may see this text: never let a
    // shared cache keep it.
    c.header("Cache-Control", "private, no-store");
    return c.json(toDocumentTextResponse(document));
  } catch (error) {
    console.error("Failed to get project document text:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * POST / - Create a document record after upload to R2
 * Body:
 * - projectId: UUID of the project
 * - filename: Sanitized filename used in storage
 * - originalFilename: Original filename from user
 * - mimeType: MIME type of the file
 * - size: File size in bytes
 * - url: R2 storage URL
 *
 * Requires UPDATE permission on the project (Editor+)
 */
projectDocumentsRouter.post("/", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();

    // Validate request body
    const validationResult = createDocumentSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const { projectId, filename, originalFilename, mimeType, size, url } =
      validationResult.data;

    // The registered URL must be an object THIS user uploaded (their own
    // `uploads/{userId}/` prefix), not merely any URL in our bucket. Otherwise
    // an editor could register another tenant's blob — making it downloadable
    // through the project and deletable via the DELETE route below (IDOR).
    if (!isOwnedUploadUrl(url, user.userId)) {
      return c.json({ error: "File URL must reference your own upload" }, 400);
    }

    // Check if user has UPDATE permission on the project (Editor+)
    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      projectId,
      EntityType.PROJECT,
      Action.UPDATE,
    );

    if (!permissionResult.allowed) {
      return c.json(
        { error: "Forbidden", reason: permissionResult.reason },
        403,
      );
    }

    // Create the document record
    const newDocument = await createProjectDocument({
      projectId,
      userId: user.userId,
      filename,
      originalFilename,
      mimeType,
      size,
      url,
    });

    await createTimelineRecord({
      projectId,
      userId: user.userId,
      entityType: "document",
      entityId: newDocument.id,
      entityName: newDocument.originalFilename,
      action: "created",
      resourceUrls: [
        {
          url: newDocument.url,
          filename: newDocument.originalFilename,
          type: newDocument.mimeType,
        },
      ],
    });

    return c.json(newDocument, 201);
  } catch (error) {
    console.error("Failed to create project document:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * PATCH /:id - Rename a document (display name only)
 *
 * Body:
 * - originalFilename: New display name (1-255 chars, trimmed). The extension is
 *   forced to match the existing document's — a supplied extension that differs
 *   or is missing gets replaced with the original one.
 *
 * Storage fields (filename, url) are never touched.
 *
 * Authorization: project member with READ if they uploaded the document,
 * otherwise editor+ (UPDATE permission). Uploading alone is never enough —
 * membership is re-checked on every call.
 */
projectDocumentsRouter.patch("/:id", async (c) => {
  try {
    const user = c.get("user");
    const documentId = c.req.param("id");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const parseResult = uuidSchema.safeParse(documentId);
    if (!parseResult.success) {
      return c.json({ error: "Invalid document ID format" }, 400);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const validationResult = renameDocumentSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const { originalFilename } = validationResult.data;

    // Get the document to check ownership and project
    const existingDocument = await getProjectDocumentById(documentId);
    if (!existingDocument) {
      return c.json({ error: "Document not found" }, 404);
    }

    // Uploading is a discount on the required permission, never a bypass of it:
    // a user removed from the project must lose access to the documents they
    // uploaded, so the check always runs — the uploader only needs READ where
    // anyone else needs UPDATE. Same shape as the comment-visibility route.
    const isUploader =
      existingDocument.userId != null &&
      existingDocument.userId === user.userId;

    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      existingDocument.projectId,
      EntityType.PROJECT,
      isUploader ? Action.READ : Action.UPDATE,
    );

    if (!permissionResult.allowed) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Display-name-only rename with the stored file's extension pinned
    const renamed = normalizeRenamedFilename(
      originalFilename,
      existingDocument.originalFilename,
    );
    if ("error" in renamed) {
      return c.json({ error: renamed.error }, 400);
    }

    const updatedDocument = await updateProjectDocument(documentId, {
      originalFilename: renamed.filename,
    });

    if (!updatedDocument) {
      return c.json({ error: "Document not found" }, 404);
    }

    // Best-effort: the rename is already persisted, so a timeline failure
    // must not turn the response into a 500.
    try {
      await createTimelineRecord({
        projectId: updatedDocument.projectId,
        userId: user.userId,
        entityType: "document",
        entityId: updatedDocument.id,
        entityName: updatedDocument.originalFilename,
        action: "updated",
        changes: [
          {
            field: "originalFilename",
            previousValue: existingDocument.originalFilename,
            newValue: updatedDocument.originalFilename,
            valueType: "text",
          },
        ],
        resourceUrls: [
          {
            url: updatedDocument.url,
            filename: updatedDocument.originalFilename,
            type: updatedDocument.mimeType,
          },
        ],
      });
    } catch (timelineError) {
      console.error("Failed to record rename in timeline:", timelineError);
    }

    return c.json(updatedDocument);
  } catch (error) {
    console.error("Failed to rename project document:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * DELETE /:id - Delete a document
 *
 * Authorization: project member with READ if they uploaded the document,
 * otherwise editor+ (UPDATE permission). Uploading alone is never enough —
 * membership is re-checked on every call.
 */
projectDocumentsRouter.delete("/:id", async (c) => {
  try {
    const user = c.get("user");
    const documentId = c.req.param("id");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const parseResult = uuidSchema.safeParse(documentId);
    if (!parseResult.success) {
      return c.json({ error: "Invalid document ID format" }, 400);
    }

    // Get the document to check ownership and project
    const existingDocument = await getProjectDocumentById(documentId);
    if (!existingDocument) {
      return c.json({ error: "Document not found" }, 404);
    }

    // Uploading is a discount on the required permission, never a bypass of it:
    // a user removed from the project must lose access to the documents they
    // uploaded, so the check always runs — the uploader only needs READ where
    // anyone else needs UPDATE. Same shape as the comment-visibility route.
    const isUploader =
      existingDocument.userId != null &&
      existingDocument.userId === user.userId;

    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      existingDocument.projectId,
      EntityType.PROJECT,
      isUploader ? Action.READ : Action.UPDATE,
    );

    if (!permissionResult.allowed) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Row first, then the stored object only if it belongs to this row's
    // uploader/project and no copied row still references it.
    await removeProjectDocument(existingDocument);

    await createTimelineRecord({
      projectId: existingDocument.projectId,
      userId: user.userId,
      entityType: "document",
      entityId: documentId,
      entityName: existingDocument.originalFilename,
      action: "deleted",
    });

    return c.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Failed to delete project document:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
