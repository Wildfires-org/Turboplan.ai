/**
 * Project Documents API routes
 *
 * Endpoints for managing uploaded documents (PDFs, DOCX, etc.) in projects:
 * - GET /api/project-documents?projectId=xxx - List all documents for a project
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
import {
  isOwnedUploadUrl,
  isStorageUrl,
} from "@wildfires-org/turboplan-upload/server";

import { removeProjectDocument } from "../projects/documents";

// Allowed MIME types for document uploads
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Zod validation schemas
const createDocumentSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  filename: z.string().min(1, "Filename is required").max(255),
  originalFilename: z.string().min(1, "Original filename is required").max(255),
  mimeType: z
    .string()
    .refine(
      (type) => ALLOWED_MIME_TYPES.includes(type),
      "File type not allowed. Only PDF and Word documents are supported.",
    ),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE, `File size exceeds maximum allowed (50MB)`),
  // User-registered documents must live in our own storage bucket. Anything
  // else lets a project editor point the document extractor at an arbitrary
  // host (SSRF, including DNS-rebinding, which hostname checks cannot stop).
  url: z
    .string()
    .url("Invalid file URL")
    .refine((value) => isStorageUrl(value), "File URL must point to storage"),
});

// Maximum filename length, extension included
const MAX_FILENAME_LENGTH = 255;

// Rejects Unicode control (\p{Cc}) and format (\p{Cf}) characters. Both classes
// are invisible but load-bearing in the places this name ends up: CR/LF would
// inject headers into the download's Content-Disposition, NUL truncates in
// C-string consumers, and U+202E (RTLO, a Cf character) visually reverses the
// tail so "fdp.exe" renders as "exe.pdf" — spoofing an extension that the
// pinning below otherwise guarantees.
const FILENAME_SAFE_PATTERN = /^[^\p{Cc}\p{Cf}]+$/u;

const renameDocumentSchema = z.object({
  originalFilename: z
    .string()
    .trim()
    .min(1, "Filename is required")
    .max(MAX_FILENAME_LENGTH, "Filename must be 255 characters or fewer")
    .refine(
      (value) => !value.includes("/") && !value.includes("\\"),
      "Filename must not contain path separators",
    )
    .refine(
      (value) => FILENAME_SAFE_PATTERN.test(value),
      "Filename must not contain control or formatting characters",
    ),
});

/**
 * Splits a filename into basename and extension (leading dot included).
 * Names with no dot ("README") and dotfiles (".env") have no extension.
 */
const splitFilename = (filename: string) => {
  const dotIndex = filename.lastIndexOf(".");

  if (dotIndex <= 0) {
    return { basename: filename, extension: "" };
  }

  return {
    basename: filename.slice(0, dotIndex),
    extension: filename.slice(dotIndex),
  };
};

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

    // Rename is display-name-only: the extension is pinned to whatever the
    // stored file already had. The dialog only lets the basename be edited, but
    // a direct API call could strip the extension (breaking downloads, which
    // use this name verbatim) or swap in a misleading one (".exe"). Re-append
    // the original extension whenever the request drops or changes it.
    const { extension } = splitFilename(existingDocument.originalFilename);
    const { basename } = splitFilename(originalFilename);
    const requestedBasename = basename.trim();

    if (requestedBasename.length === 0) {
      return c.json({ error: "Filename is required" }, 400);
    }

    const normalizedFilename = `${requestedBasename}${extension}`;

    if (normalizedFilename.length > MAX_FILENAME_LENGTH) {
      return c.json({ error: "Filename must be 255 characters or fewer" }, 400);
    }

    const updatedDocument = await updateProjectDocument(documentId, {
      originalFilename: normalizedFilename,
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
