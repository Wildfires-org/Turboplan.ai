import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  NO_PERMISSION_REASON,
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import { generatePdfFromMarkdown } from "@wildfires-org/turboplan-signing/pdf";
import {
  appendOfficeDocumentProfileFact,
  editDocumentOwnLetterhead,
  getDocumentLetterheadOverview,
  getProjectById,
  getProjectDocumentBranding,
  getProjectDocumentProfile,
  getProjectFooter,
  resolveDocumentLetterheadLogo,
  setDocumentLetterheadSelection,
} from "@wildfires-org/turboplan-workspace/server";
import {
  buildLetterheadMarkdown,
  documentProfileToFacts,
  gridLetterheadEditSchema,
  LETTERHEAD_EDIT_CONFLICT_ERROR,
  parseLetterheadLogoIndex,
  toPublicDocumentLetterhead,
} from "@wildfires-org/turboplan-workspace/types";

// Bound the input so the synchronous markdown parser + PDFKit can't be driven
// into excessive CPU/memory by an oversized payload.
const MAX_CONTENT_LENGTH = 500_000;

const exportPdfSchema = z.object({
  content: z
    .string()
    .min(1, "content is required")
    .max(MAX_CONTENT_LENGTH, "content too large"),
  title: z.string().max(500),
  // Present when the export is tied to a saved project document. Drives the
  // RBAC check below.
  projectId: z.string().optional(),
  // The saved chat document being exported; selects its letterhead. Ignored
  // without a projectId.
  documentId: z.string().uuid().optional(),
});

// "own" is the document's copy of its reference's letterhead; selecting it
// without a copy is refused like an unknown letterhead (404).
export const letterheadSelectionSchema = z.object({
  projectId: z.string().uuid(),
  selection: z.union([
    z.literal("default"),
    z.literal("none"),
    z.literal("own"),
    z.string().uuid(),
  ]),
});

// PUT /:documentId/letterhead/own: the edited grid is parsed with the
// workspace's `gridLetterheadEditSchema` on its own (see the handler).
// `version`: the copy's `own.version` from GET /letterhead when the editor
// opened (its `updated_at`, an ISO timestamp).
const ownLetterheadEditBodySchema = z.object({
  projectId: z.string().uuid(),
  version: z.string().datetime(),
  grid: z.unknown(),
});

// The same 409 body as an office/organization default grid's edit.
export const OWN_LETTERHEAD_CONFLICT_ERROR = LETTERHEAD_EDIT_CONFLICT_ERROR;

const rememberFactSchema = z.object({
  projectId: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(300),
});

// Same body as the RBAC guards' denial, so an unknown project can't be told
// apart from one the caller may not edit.
const forbidden = (c: Context<RBACContext>) =>
  c.json({ error: "Forbidden", reason: NO_PERMISSION_REASON }, 403);

// Optional `documentId` query param: absent → the default letterhead; a
// malformed value is a 400 rather than a silent default.
const parseDocumentIdQuery = (
  c: Context<RBACContext>,
): { documentId: string | undefined } | null => {
  const raw = c.req.query("documentId");
  if (!raw) {
    return { documentId: undefined };
  }
  const parsed = z.string().uuid().safeParse(raw);
  return parsed.success ? { documentId: parsed.data } : null;
};

const exportPdfHandler = async (c: Context<RBACContext>) => {
  try {
    const body = await c.req.json();
    const parsed = exportPdfSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const { content, title, projectId, documentId } = parsed.data;

    // When the export is scoped to a project, require READ on it so the
    // endpoint can't render documents on behalf of a project the caller can't
    // access. Drafts with no projectId are a pure content-only transform (the
    // caller already holds the content) and need only authentication, which
    // the upstream `/api/*` auth middleware already enforces.
    let pdfContent = content;
    let options: Parameters<typeof generatePdfFromMarkdown>[2];

    if (projectId) {
      const permCheck = requirePermission(
        EntityType.PROJECT,
        Action.READ,
        () => projectId,
      );
      const denied = await permCheck(c, async () => {});
      if (denied) {
        return denied;
      }

      // Brand the PDF with the letterhead logo, footer and structured
      // letterhead the document selected (default: office → org fallback). The
      // letterhead is prepended only when the document doesn't already open
      // with its own letterhead table.
      const branding = await getProjectDocumentBranding(
        projectId,
        content,
        documentId,
      );
      pdfContent = branding.content;
      options = {
        logo: branding.logo ?? undefined,
        footer: branding.footer,
        logoPlacement: branding.logoPlacement,
        accentColor: branding.color ?? undefined,
        gridLetterhead: branding.gridLetterhead ?? undefined,
      };
    }

    const bytes = await generatePdfFromMarkdown(pdfContent, title, options);

    return new Response(Buffer.from(bytes), {
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (error) {
    console.error("[document-export] Error:", error);
    return c.json({ error: "Failed to generate PDF" }, 500);
  }
};

const letterheadLogoHandler = async (c: Context<RBACContext>) => {
  try {
    const projectId = c.req.query("projectId");

    if (!projectId) {
      return c.json({ error: "projectId is required" }, 400);
    }

    const query = parseDocumentIdQuery(c);
    if (!query) {
      return c.json({ error: "Invalid documentId" }, 400);
    }

    // Optional `index`: a grid's logo cell (its `index` in GET /letterhead);
    // a malformed one is a 400 before the permission check.
    const index = parseLetterheadLogoIndex(c.req.query("index"));
    if (index === null) {
      return c.json({ error: "Invalid index" }, 400);
    }

    // Require READ on the project — same RBAC contract as export-pdf — so the
    // endpoint can't leak an entity's branding to callers without project access.
    const permCheck = requirePermission(
      EntityType.PROJECT,
      Action.READ,
      () => projectId,
    );
    const denied = await permCheck(c, async () => {});
    if (denied) {
      return denied;
    }

    // `index` picks a grid's logo cell; every other letterhead (and a grid
    // without logo cells) has its one logo at index 0. Only that logo is
    // fetched.
    const logo = await resolveDocumentLetterheadLogo(
      projectId,
      query.documentId,
      index,
    );

    if (!logo) {
      // No logo configured, letterhead "none", no such logo cell, or
      // unsupported/unreachable source.
      return c.body(null, 204);
    }

    return new Response(Buffer.from(logo.data), {
      headers: { "Content-Type": logo.contentType },
    });
  } catch (error) {
    console.error("[document-export] letterhead-logo error:", error);
    return c.json({ error: "Failed to fetch letterhead logo" }, 500);
  }
};

const footerHandler = async (c: Context<RBACContext>) => {
  try {
    const projectId = c.req.query("projectId");

    if (!projectId) {
      return c.json({ error: "projectId is required" }, 400);
    }

    // Require READ on the project — same RBAC contract as export-pdf — so the
    // endpoint can't leak an entity's footer branding to callers without project
    // access.
    const permCheck = requirePermission(
      EntityType.PROJECT,
      Action.READ,
      () => projectId,
    );
    const denied = await permCheck(c, async () => {});
    if (denied) {
      return denied;
    }

    const footer = await getProjectFooter(projectId);

    return c.json({
      text: footer.text,
      note: footer.note,
      logo: footer.logo
        ? {
            dataBase64: Buffer.from(footer.logo.data).toString("base64"),
            contentType: footer.logo.contentType,
          }
        : null,
    });
  } catch (error) {
    console.error("[document-export] footer error:", error);
    return c.json({ error: "Failed to fetch footer" }, 500);
  }
};

const letterheadHandler = async (c: Context<RBACContext>) => {
  try {
    const projectId = c.req.query("projectId");

    if (!projectId) {
      return c.json({ error: "projectId is required" }, 400);
    }

    const query = parseDocumentIdQuery(c);
    if (!query) {
      return c.json({ error: "Invalid documentId" }, 400);
    }

    // Require READ on the project — same RBAC contract as export-pdf — so the
    // endpoint can't leak an entity's letterhead to callers without project
    // access.
    const permCheck = requirePermission(
      EntityType.PROJECT,
      Action.READ,
      () => projectId,
    );
    const denied = await permCheck(c, async () => {});
    if (denied) {
      return denied;
    }

    const overview = await getDocumentLetterheadOverview(
      projectId,
      query.documentId,
    );

    return c.json({
      // A grid's logo cells go out as their `index` (served by
      // /letterhead-logo?index=), never as the raw storage key.
      letterhead:
        overview.letterhead && toPublicDocumentLetterhead(overview.letterhead),
      // null when there is no letterhead, it is a banner (a banner is the
      // logo graphic, not a markdown table) or a grid (every renderer draws a
      // grid from its structure).
      markdown:
        overview.letterhead && overview.letterhead.layout !== "grid"
          ? buildLetterheadMarkdown(overview.letterhead) || null
          : null,
      selection: overview.selection,
      defaultLetterhead:
        overview.defaultLetterhead &&
        toPublicDocumentLetterhead(overview.defaultLetterhead),
      options: overview.options,
      // The document's copy of its reference's letterhead, offered in the
      // picker whatever is selected, with the version the letterhead editor
      // sends back; null without one.
      own: overview.own,
    });
  } catch (error) {
    console.error("[document-export] letterhead error:", error);
    return c.json({ error: "Failed to fetch letterhead" }, 500);
  }
};

// PUT /:documentId/letterhead — choose the document's letterhead. A document
// outside the project and a letterhead outside the project's organization
// answer the same 404, so neither can be probed.
const setLetterheadHandler = async (c: Context<RBACContext>) => {
  try {
    const documentId = z.string().uuid().safeParse(c.req.param("documentId"));
    const body = letterheadSelectionSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!documentId.success || !body.success) {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const { projectId, selection } = body.data;
    const permCheck = requirePermission(
      EntityType.PROJECT,
      Action.UPDATE,
      () => projectId,
    );
    const denied = await permCheck(c, async () => {});
    if (denied) {
      return denied;
    }

    const result = await setDocumentLetterheadSelection({
      projectId,
      documentId: documentId.data,
      selection,
      userId: c.get("user").userId,
    });
    if (!result.ok) {
      return c.json({ error: "Document or letterhead not found" }, 404);
    }

    return c.json({ selection });
  } catch (error) {
    console.error("[document-export] set letterhead error:", error);
    return c.json({ error: "Failed to update letterhead" }, 500);
  }
};

// PUT /:documentId/letterhead/own — replace the document's own copy of its
// reference's letterhead with the letterhead editor's version (only that
// document; the selection is left as it is). Body `{ projectId, version,
// grid }`, the grid in the editor's shape: logo cells keep a stored logo by
// `index` or bring a new upload of the caller by `url`. A document outside
// the project and one without a copy answer the same 404 as PUT
// /:documentId/letterhead; a copy that is no longer `version` a 409 (its
// logo indexes may mean other logos now); an invalid grid a 400 naming the
// offending field. 200: the saved letterhead and the copy's new version.
const editOwnLetterheadHandler = async (c: Context<RBACContext>) => {
  try {
    const documentId = z.string().uuid().safeParse(c.req.param("documentId"));
    const body = ownLetterheadEditBodySchema.safeParse(
      await c.req.json().catch(() => null),
    );
    const grid = body.success
      ? gridLetterheadEditSchema.safeParse(body.data.grid)
      : null;
    if (!documentId.success || !body.success || !grid?.success) {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const { projectId, version } = body.data;
    const permCheck = requirePermission(
      EntityType.PROJECT,
      Action.UPDATE,
      () => projectId,
    );
    const denied = await permCheck(c, async () => {});
    if (denied) {
      return denied;
    }

    const result = await editDocumentOwnLetterhead({
      projectId,
      documentId: documentId.data,
      version,
      edit: grid.data,
      userId: c.get("user").userId,
    });
    if (!result.ok) {
      switch (result.reason) {
        case "not_found":
          return c.json({ error: "Document or letterhead not found" }, 404);
        case "conflict":
          return c.json({ error: OWN_LETTERHEAD_CONFLICT_ERROR }, 409);
        default:
          return c.json({ error: result.message, field: result.field }, 400);
      }
    }

    // As GET /letterhead sends it: logo cells by `index`, never a URL.
    return c.json({
      letterhead: toPublicDocumentLetterhead(result.letterhead),
      version: result.version,
    });
  } catch (error) {
    console.error("[document-export] edit own letterhead error:", error);
    return c.json({ error: "Failed to update letterhead" }, 500);
  }
};

// GET /profile?projectId= — the project's merged document profile (office over
// organization) plus its fact lines, used to prefill the document UI.
const profileHandler = async (c: Context<RBACContext>) => {
  try {
    const projectId = z.string().uuid().safeParse(c.req.query("projectId"));
    if (!projectId.success) {
      return c.json({ error: "projectId is required" }, 400);
    }

    const permCheck = requirePermission(
      EntityType.PROJECT,
      Action.READ,
      () => projectId.data,
    );
    const denied = await permCheck(c, async () => {});
    if (denied) {
      return denied;
    }

    const profile = await getProjectDocumentProfile(projectId.data);
    return c.json({ profile, facts: documentProfileToFacts(profile) });
  } catch (error) {
    console.error("[document-export] profile error:", error);
    return c.json({ error: "Failed to fetch document profile" }, 500);
  }
};

// POST /remember-fact — append `label: value` to the facts of the document
// profile of the office that owns the project. Requires UPDATE on that office;
// an unknown project answers the same 403 as a denial.
const rememberFactHandler = async (c: Context<RBACContext>) => {
  try {
    const body = rememberFactSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!body.success) {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const { projectId, label, value } = body.data;
    const officeId = (await getProjectById(projectId))?.officeId;
    if (!officeId) {
      return forbidden(c);
    }
    const permCheck = requirePermission(
      EntityType.OFFICE,
      Action.UPDATE,
      () => officeId,
    );
    const denied = await permCheck(c, async () => {});
    if (denied) {
      return denied;
    }

    const result = await appendOfficeDocumentProfileFact(
      officeId,
      label,
      value,
    );
    if (!result.ok) {
      return result.reason === "facts_too_long"
        ? c.json({ error: "The office has too many remembered facts" }, 400)
        : forbidden(c);
    }

    return c.json({ documentProfile: result.documentProfile });
  } catch (error) {
    console.error("[document-export] remember-fact error:", error);
    return c.json({ error: "Failed to remember fact" }, 500);
  }
};

const documentExportRouter = new Hono<RBACContext>();
documentExportRouter.post("/export-pdf", exportPdfHandler);
documentExportRouter.get("/letterhead-logo", letterheadLogoHandler);
documentExportRouter.get("/footer", footerHandler);
documentExportRouter.get("/letterhead", letterheadHandler);
documentExportRouter.put("/:documentId/letterhead", setLetterheadHandler);
documentExportRouter.put(
  "/:documentId/letterhead/own",
  editOwnLetterheadHandler,
);
documentExportRouter.get("/profile", profileHandler);
documentExportRouter.post("/remember-fact", rememberFactHandler);

export { documentExportRouter };
