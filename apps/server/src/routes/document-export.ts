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
  getDocumentLetterheadOverview,
  getProjectById,
  getProjectDocumentBranding,
  getProjectDocumentProfile,
  getProjectFooter,
  resolveDocumentLetterhead,
  setDocumentLetterheadSelection,
} from "@wildfires-org/turboplan-workspace/server";
import {
  buildLetterheadMarkdown,
  documentProfileToFacts,
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

const letterheadSelectionSchema = z.object({
  projectId: z.string().uuid(),
  selection: z.union([
    z.literal("default"),
    z.literal("none"),
    z.string().uuid(),
  ]),
});

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

    const { logo } = await resolveDocumentLetterhead(
      projectId,
      query.documentId,
    );

    if (!logo) {
      // No logo configured, letterhead "none", or unsupported/unreachable
      // source.
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
      letterhead: overview.letterhead,
      // null when there is no letterhead or it is a banner (a banner is the
      // logo graphic, not a markdown table).
      markdown: overview.letterhead
        ? buildLetterheadMarkdown(overview.letterhead) || null
        : null,
      selection: overview.selection,
      defaultLetterhead: overview.defaultLetterhead,
      options: overview.options,
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
documentExportRouter.get("/profile", profileHandler);
documentExportRouter.post("/remember-fact", rememberFactHandler);

export { documentExportRouter };
