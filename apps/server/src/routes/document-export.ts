import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import { generatePdfFromMarkdown } from "@wildfires-org/turboplan-signing/pdf";
import {
  getProjectFooter,
  getProjectLetterheadLogo,
} from "@wildfires-org/turboplan-workspace/server";

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
});

const exportPdfHandler = async (c: Context<RBACContext>) => {
  try {
    const body = await c.req.json();
    const parsed = exportPdfSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const { content, title, projectId } = parsed.data;

    // When the export is scoped to a project, require READ on it so the
    // endpoint can't render documents on behalf of a project the caller can't
    // access. Drafts with no projectId are a pure content-only transform (the
    // caller already holds the content) and need only authentication, which
    // the upstream `/api/*` auth middleware already enforces.
    let logo: { data: Uint8Array; contentType: string } | null = null;
    let footer: Awaited<ReturnType<typeof getProjectFooter>> | null = null;

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

      // Resolve the letterhead logo (office → org fallback) so the PDF can be
      // rendered with the entity's branding. Null when none is configured.
      logo = await getProjectLetterheadLogo(projectId);

      // Resolve the document footer (per-field office → org fallback) so the
      // PDF can render the entity's tagline, note, and footer logo.
      footer = await getProjectFooter(projectId);
    }

    const options =
      logo || footer
        ? {
            logo: logo ?? undefined,
            footer: footer
              ? { text: footer.text, note: footer.note, logo: footer.logo }
              : undefined,
          }
        : undefined;

    const bytes = await generatePdfFromMarkdown(content, title, options);

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

    const logo = await getProjectLetterheadLogo(projectId);

    if (!logo) {
      // No logo configured (or unsupported/unreachable source).
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

const documentExportRouter = new Hono<RBACContext>();
documentExportRouter.post("/export-pdf", exportPdfHandler);
documentExportRouter.get("/letterhead-logo", letterheadLogoHandler);
documentExportRouter.get("/footer", footerHandler);

export { documentExportRouter };
