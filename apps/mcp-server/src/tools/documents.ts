import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runWithWorkerConnection } from "@wildfires-org/turboplan-db/db-client";
import {
  createProjectDocument,
  getProjectDocumentById,
  getProjectDocumentsByProjectId,
} from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";
import {
  uniqueStorageName,
  uploadFile,
} from "@wildfires-org/turboplan-upload/server";
import { removeProjectDocument } from "@wildfires-org/turboplan-workspace/server";

import { assertEntityExists, assertPermission } from "../utils/permissions.js";
import { projectExists } from "../utils/queries.js";
import { fetchWithSsrfGuard } from "../utils/ssrf.js";
import type { McpUserContext } from "../utils/types.js";
import { entityIdSchema, validateToolInput } from "../utils/validation.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_BASE64_SIZE = Math.ceil((MAX_FILE_SIZE * 4) / 3); // ~67MB base64

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 200);
};

const getExtensionFromMimeType = (mimeType: string): string => {
  const map: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
  };
  return map[mimeType] ?? "";
};

const buildStoredFilename = (
  originalFilename: string,
  mimeType: string,
): string => {
  const sanitized = sanitizeFilename(originalFilename);
  const ext = getExtensionFromMimeType(mimeType);
  if (ext && sanitized.toLowerCase().endsWith(ext)) {
    return sanitized;
  }
  return `${sanitized}${ext}`;
};

// The shared helper appends a full random UUID: stored objects are served from
// public URLs, so the key must be unguessable, and concurrent uploads of the
// same name must not overwrite each other.
const buildUniqueStoredFilename = (
  originalFilename: string,
  mimeType: string,
): string => {
  return uniqueStorageName(buildStoredFilename(originalFilename, mimeType));
};

// Reads the response body enforcing the size cap as bytes arrive, so a
// response without a Content-Length header (or a lying one) cannot buffer
// an unbounded payload into Worker memory. Returns null when the cap is hit.
//
// Peak memory stays ~1x the body: with a trustworthy Content-Length the body
// is written straight into one preallocated buffer; otherwise chunks are
// concatenated once and each chunk is released as soon as it is copied.
export const readBodyWithLimit = async (
  response: Response,
  maxBytes: number,
): Promise<Uint8Array | null> => {
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    return buffer.byteLength > maxBytes ? null : new Uint8Array(buffer);
  }

  const declaredLength = Number(response.headers.get("content-length") ?? "");
  let preallocated =
    Number.isInteger(declaredLength) &&
    declaredLength > 0 &&
    declaredLength <= maxBytes
      ? new Uint8Array(declaredLength)
      : null;
  let chunks: Array<Uint8Array | null> = [];
  let total = 0;

  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    if (total + value.byteLength > maxBytes) {
      await reader.cancel();
      return null;
    }
    if (preallocated && total + value.byteLength > preallocated.byteLength) {
      // Content-Length undercounted (e.g. a decoded compressed body): fall
      // back to collecting chunks, keeping what was already read.
      chunks = [preallocated.subarray(0, total)];
      preallocated = null;
    }
    if (preallocated) {
      preallocated.set(value, total);
    } else {
      chunks.push(value);
    }
    total += value.byteLength;
  }

  if (preallocated) {
    return total === preallocated.byteLength
      ? preallocated
      : preallocated.subarray(0, total);
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] as Uint8Array;
    combined.set(chunk, offset);
    offset += chunk.byteLength;
    chunks[i] = null;
  }
  return combined;
};

export const MAX_DOCUMENTS_PER_BATCH = 8;
// Downloads run one at a time: each holds up to MAX_FILE_SIZE in memory and
// the Worker isolate is capped at 128MB.
const URL_DOWNLOAD_CONCURRENCY = 1;
// Total bytes one upload_documents_from_urls call may download across all
// of its URLs. Each item may use at most the budget that is left.
export const MAX_BATCH_DOWNLOAD_BYTES = 60 * 1024 * 1024; // 60MB

// Per-item shape shared by upload_document_from_url and the batch variant.
export const urlDocumentSchema = z.object({
  url: z.string().url(),
  originalFilename: z.string().min(1).max(255),
  relevance: z.number().int().min(0).max(100).optional(),
  context: z.string().max(2000).optional(),
  folder: z.string().max(255).optional(),
  folderDescription: z.string().max(255).optional(),
});

type UrlDocumentInput = z.infer<typeof urlDocumentSchema>;

// The exact array schema the upload_documents_from_urls handler validates
// against: 1-8 items, no duplicate URLs within the batch.
export const uploadDocumentsFromUrlsSchema = z
  .array(urlDocumentSchema)
  .min(1)
  .max(MAX_DOCUMENTS_PER_BATCH)
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const url = items[i].url;
      if (seen.has(url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "url"],
          message: `Duplicate URL within the batch: ${url}`,
        });
      }
      seen.add(url);
    }
  });

type UrlDocumentResult =
  | {
      success: true;
      document: {
        id: string;
        originalFilename: string;
        mimeType: string;
        size: number;
        url: string;
      };
    }
  | { success: false; error: string };

// Downloads one document from a URL, validates type/size, stores it in R2,
// persists the row, and records a timeline entry — the exact per-item logic
// shared by the singular and batch URL-upload tools. Callers are responsible
// for the one-time project-exists and permission checks.
// `maxBytes` lets the batch tool pass the remaining per-call download budget;
// it never exceeds the per-file MAX_FILE_SIZE cap.
export const processUrlDocument = async (
  projectId: string,
  item: UrlDocumentInput,
  user: McpUserContext,
  maxBytes: number = MAX_FILE_SIZE,
): Promise<UrlDocumentResult> => {
  const limit = Math.min(maxBytes, MAX_FILE_SIZE);
  const sizeError =
    limit < MAX_FILE_SIZE
      ? `File exceeds the remaining download budget for this call (${Math.floor(limit / (1024 * 1024))}MB of ${MAX_BATCH_DOWNLOAD_BYTES / (1024 * 1024)}MB). Upload it in a separate call.`
      : "File exceeds 50MB size limit.";

  // SSRF guard: validate the URL (and every redirect hop) against private,
  // loopback, link-local, and metadata ranges before fetching. HTTP is allowed
  // since document sources are not restricted to HTTPS, but non-http(s) schemes
  // and internal addresses are rejected.
  const fetchResult = await fetchWithSsrfGuard(item.url, {
    allowHttp: true,
    timeoutMs: 30000,
    fetchFailureMessage: "Failed to fetch document from URL.",
  });
  if ("error" in fetchResult && fetchResult.error) {
    return { success: false, error: fetchResult.error };
  }
  const response = fetchResult.response as Response;

  if (!response.ok) {
    return { success: false, error: `URL returned HTTP ${response.status}.` };
  }

  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    return {
      success: false,
      error: `Unsupported file type: ${contentType}. Allowed: PDF, DOC, DOCX.`,
    };
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > limit) {
    await response.body?.cancel();
    return { success: false, error: sizeError };
  }

  const buffer = await readBodyWithLimit(response, limit);
  if (!buffer) {
    return { success: false, error: sizeError };
  }

  const storedFilename = buildUniqueStoredFilename(
    item.originalFilename,
    contentType,
  );
  const blobPath = `mcp/${projectId}/${storedFilename}`;

  const { url: blobUrl } = await uploadFile(blobPath, buffer, contentType);

  const doc = await createProjectDocument({
    projectId,
    userId: user.userId,
    filename: storedFilename,
    originalFilename: item.originalFilename,
    mimeType: contentType,
    size: buffer.byteLength,
    url: blobUrl,
    relevance: item.relevance ?? null,
    context: item.context ?? null,
    folder: item.folder ?? null,
    folderDescription: item.folderDescription ?? null,
  });

  await createTimelineRecord({
    projectId,
    userId: user.userId,
    entityType: "document",
    entityId: doc.id,
    entityName: item.originalFilename,
    action: "created",
    metadata: { source: "mcp", actor: user.actor },
  });

  return {
    success: true,
    document: {
      id: doc.id,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      size: doc.size,
      url: doc.url,
    },
  };
};

export const registerDocumentTools = (
  server: McpServer,
  user: McpUserContext,
  storage: { publicUrl: string },
) => {
  server.registerTool(
    "list_project_documents",
    {
      description:
        "List all uploaded documents for a project. Documents include PDFs, Word files, and other files uploaded by users or discovered by the research agent. Each document has metadata including relevance score (0-100), context description, and folder grouping. Requires read access to the project.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ projectId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({ projectId: entityIdSchema }),
          { projectId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const proj = await projectExists(projectId as string);
        const notFound = assertEntityExists(
          proj,
          projectId as string,
          "project",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.READ,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const documents = await getProjectDocumentsByProjectId(
          projectId as string,
        );

        const result = documents.map((d) => ({
          id: d.id,
          originalFilename: d.originalFilename,
          mimeType: d.mimeType,
          size: d.size,
          url: d.url,
          relevance: d.relevance,
          context: d.context,
          folder: d.folder,
          folderDescription: d.folderDescription,
          createdAt: d.createdAt,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "upload_document_from_url",
    {
      description:
        "Upload a document to a project by fetching it from a URL. Supports PDF and Word files up to 50MB. The file is downloaded server-side and stored in R2 storage. Requires editor role or higher. When uploading multiple documents at once, prefer upload_documents_from_urls.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        url: z.string().url().describe("URL to fetch the document from"),
        originalFilename: z
          .string()
          .min(1)
          .max(255)
          .describe("Display filename (e.g. 'report.pdf')"),
        relevance: z
          .number()
          .int()
          .min(0)
          .max(100)
          .optional()
          .describe("Relevance score 0-100"),
        context: z
          .string()
          .max(2000)
          .optional()
          .describe("Why this document matters"),
        folder: z
          .string()
          .max(255)
          .optional()
          .describe("Folder/group name for organizing"),
        folderDescription: z
          .string()
          .max(255)
          .optional()
          .describe("Description of the folder group"),
      },
    },
    async ({
      projectId,
      url,
      originalFilename,
      relevance,
      context,
      folder,
      folderDescription,
    }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            url: z.string().url(),
            originalFilename: z.string().min(1).max(255),
            relevance: z.number().int().min(0).max(100).optional(),
            context: z.string().max(2000).optional(),
            folder: z.string().max(255).optional(),
            folderDescription: z.string().max(255).optional(),
          }),
          {
            projectId,
            url,
            originalFilename,
            relevance,
            context,
            folder,
            folderDescription,
          },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const proj = await projectExists(projectId as string);
        const notFound = assertEntityExists(
          proj,
          projectId as string,
          "project",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        const result = await processUrlDocument(
          projectId as string,
          validated,
          user,
        );

        if (!result.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: result.error }],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  document: result.document,
                },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "upload_documents_from_urls",
    {
      description:
        "Upload multiple documents to a project by fetching them from URLs in a single call. Supports PDF and Word files up to 50MB each. Files are downloaded server-side one at a time and stored in R2; the combined download size per call is capped at 60MB, so split larger sets across calls. Requires editor role or higher. Maximum 8 documents per call; duplicate URLs within the batch are rejected. Best-effort per item: one bad URL does not fail the others — returns per-item results.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        documents: z
          .array(
            z.object({
              url: z.string().url().describe("URL to fetch the document from"),
              originalFilename: z
                .string()
                .min(1)
                .max(255)
                .describe("Display filename (e.g. 'report.pdf')"),
              relevance: z
                .number()
                .int()
                .min(0)
                .max(100)
                .optional()
                .describe("Relevance score 0-100"),
              context: z
                .string()
                .max(2000)
                .optional()
                .describe("Why this document matters"),
              folder: z
                .string()
                .max(255)
                .optional()
                .describe("Folder/group name for organizing"),
              folderDescription: z
                .string()
                .max(255)
                .optional()
                .describe("Description of the folder group"),
            }),
          )
          .min(1)
          .max(MAX_DOCUMENTS_PER_BATCH)
          .describe(`Documents to upload (1-${MAX_DOCUMENTS_PER_BATCH})`),
      },
    },
    async ({ projectId, documents }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            documents: uploadDocumentsFromUrlsSchema,
          }),
          { projectId, documents },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const proj = await projectExists(projectId as string);
        const notFound = assertEntityExists(
          proj,
          projectId as string,
          "project",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        // Sequential downloads (URL_DOWNLOAD_CONCURRENCY = 1) under a shared
        // byte budget so one call cannot exceed isolate memory. Per-item
        // best-effort — a failed item is reported, not thrown.
        const results: Array<{
          url: string;
          success: boolean;
          document?: {
            id: string;
            originalFilename: string;
            mimeType: string;
            size: number;
            url: string;
          };
          error?: string;
        }> = [];
        let remainingBudget = MAX_BATCH_DOWNLOAD_BYTES;

        for (
          let i = 0;
          i < validated.documents.length;
          i += URL_DOWNLOAD_CONCURRENCY
        ) {
          const chunk = validated.documents.slice(
            i,
            i + URL_DOWNLOAD_CONCURRENCY,
          );
          if (remainingBudget <= 0) {
            for (const item of chunk) {
              results.push({
                url: item.url,
                success: false,
                error: `Download budget for this call (${MAX_BATCH_DOWNLOAD_BYTES / (1024 * 1024)}MB) is used up. Upload it in a separate call.`,
              });
            }
            continue;
          }
          const budgetForChunk = remainingBudget;
          const settled = await Promise.allSettled(
            chunk.map((item) =>
              processUrlDocument(
                projectId as string,
                item,
                user,
                budgetForChunk,
              ),
            ),
          );

          settled.forEach((outcome, idx) => {
            const item = chunk[idx];
            if (outcome.status === "fulfilled") {
              if (outcome.value.success) {
                remainingBudget -= outcome.value.document.size;
                results.push({
                  url: item.url,
                  success: true,
                  document: outcome.value.document,
                });
              } else {
                results.push({
                  url: item.url,
                  success: false,
                  error: outcome.value.error,
                });
              }
            } else {
              results.push({
                url: item.url,
                success: false,
                error:
                  outcome.reason instanceof Error
                    ? outcome.reason.message
                    : "Failed to process document.",
              });
            }
          });
        }

        const successCount = results.filter((r) => r.success).length;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: successCount > 0,
                  total: results.length,
                  succeeded: successCount,
                  failed: results.length - successCount,
                  results,
                },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "upload_document_from_content",
    {
      description:
        "Upload a document to a project from base64-encoded content. Use this when you have the file content directly (e.g. from reading a local file in Claude Code). Supports PDF and Word files up to 50MB. Requires editor role or higher.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        base64Content: z
          .string()
          .min(1)
          .describe("Base64-encoded file content"),
        originalFilename: z
          .string()
          .min(1)
          .max(255)
          .describe("Display filename (e.g. 'report.pdf')"),
        mimeType: z
          .enum([
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ])
          .describe("File MIME type"),
        relevance: z
          .number()
          .int()
          .min(0)
          .max(100)
          .optional()
          .describe("Relevance score 0-100"),
        context: z
          .string()
          .max(2000)
          .optional()
          .describe("Why this document matters"),
        folder: z
          .string()
          .max(255)
          .optional()
          .describe("Folder/group name for organizing"),
        folderDescription: z
          .string()
          .max(255)
          .optional()
          .describe("Description of the folder group"),
      },
    },
    async ({
      projectId,
      base64Content,
      originalFilename,
      mimeType,
      relevance,
      context,
      folder,
      folderDescription,
    }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            base64Content: z.string().min(1).max(MAX_BASE64_SIZE),
            originalFilename: z.string().min(1).max(255),
            mimeType: z.enum([
              "application/pdf",
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ]),
            relevance: z.number().int().min(0).max(100).optional(),
            context: z.string().max(2000).optional(),
            folder: z.string().max(255).optional(),
            folderDescription: z.string().max(255).optional(),
          }),
          {
            projectId,
            base64Content,
            originalFilename,
            mimeType,
            relevance,
            context,
            folder,
            folderDescription,
          },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const proj = await projectExists(projectId as string);
        const notFound = assertEntityExists(
          proj,
          projectId as string,
          "project",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        let buffer: ArrayBuffer;
        try {
          const binaryString = atob(validated.base64Content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          buffer = bytes.buffer;
        } catch {
          return {
            isError: true,
            content: [
              { type: "text" as const, text: "Invalid base64 content." },
            ],
          };
        }

        if (buffer.byteLength > MAX_FILE_SIZE) {
          return {
            isError: true,
            content: [
              { type: "text" as const, text: "File exceeds 50MB size limit." },
            ],
          };
        }

        const storedFilename = buildUniqueStoredFilename(
          validated.originalFilename,
          validated.mimeType,
        );
        const blobPath = `mcp/${projectId}/${storedFilename}`;

        const { url: blobUrl } = await uploadFile(
          blobPath,
          buffer,
          validated.mimeType,
        );

        const doc = await createProjectDocument({
          projectId: projectId as string,
          userId: user.userId,
          filename: storedFilename,
          originalFilename: validated.originalFilename,
          mimeType: validated.mimeType,
          size: buffer.byteLength,
          url: blobUrl,
          relevance: validated.relevance ?? null,
          context: validated.context ?? null,
          folder: validated.folder ?? null,
          folderDescription: validated.folderDescription ?? null,
        });

        await createTimelineRecord({
          projectId: projectId as string,
          userId: user.userId,
          entityType: "document",
          entityId: doc.id,
          entityName: validated.originalFilename,
          action: "created",
          metadata: { source: "mcp", actor: user.actor },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  document: {
                    id: doc.id,
                    originalFilename: doc.originalFilename,
                    mimeType: doc.mimeType,
                    size: doc.size,
                    url: doc.url,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "delete_project_document",
    {
      description:
        "Delete a document from a project. Removes from both blob storage and database. Only the uploader or a project editor can delete. Requires editor role or higher if not the uploader.",
      inputSchema: {
        documentId: z.string().uuid().describe("Document UUID"),
      },
    },
    async ({ documentId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({ documentId: entityIdSchema }),
          { documentId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const existing = await getProjectDocumentById(documentId as string);
        if (!existing) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Access denied." }],
          };
        }

        // Uploader must still have project access (a removed member otherwise
        // keeps deleting their old documents). Uploader → READ, non-uploader →
        // UPDATE.
        const isUploader =
          existing.userId != null && existing.userId === user.userId;
        const denied = await assertPermission(
          user.userId,
          existing.projectId,
          EntityType.PROJECT,
          isUploader ? Action.READ : Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        // Row first, then the stored object only if it belongs to this row's
        // uploader/project and no copied row (template clone) still uses it.
        await removeProjectDocument(existing);

        await createTimelineRecord({
          projectId: existing.projectId,
          userId: user.userId,
          entityType: "document",
          entityId: documentId as string,
          entityName: existing.originalFilename,
          action: "deleted",
          metadata: { source: "mcp", actor: user.actor },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true }, null, 2),
            },
          ],
        };
      }),
  );
};
