import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type {
  OrganizationStatus,
  OrganizationType,
} from "@wildfires-org/turboplan-db";
import { runWithWorkerConnection } from "@wildfires-org/turboplan-db/db-client";
import { getCommonEnv } from "@wildfires-org/turboplan-env";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { isAdmin } from "@wildfires-org/turboplan-rbac/server";
import { uploadFile } from "@wildfires-org/turboplan-upload/server";
import {
  EMAIL_DOMAIN_REGEX,
  normalizeEmailDomains,
} from "@wildfires-org/turboplan-utils/server";
import {
  assignOrganizationOwner,
  createOrganization,
  getOrganizationById,
  getOrganizationsWithOffices,
  updateOrganization,
} from "@wildfires-org/turboplan-workspace/server";

import {
  getOrganizationCatalogUrl,
  getOrganizationDashboardUrl,
} from "../utils/entity-urls.js";
import { generateOrganizationCoverImage } from "../utils/generate-cover-image.js";
import { resolveLogoImageType } from "../utils/logo-image.js";
import {
  accessDenied,
  assertEntityExists,
  assertPermission,
} from "../utils/permissions.js";
import { fetchWithSsrfGuard } from "../utils/ssrf.js";
import type { McpUserContext } from "../utils/types.js";
import {
  descriptionSchema,
  entityIdSchema,
  nameSchema,
  searchQuerySchema,
  shortNameSchema,
  validateToolInput,
} from "../utils/validation.js";

// Organization type enum values accepted by the create/update tools. Kept in one
// place so create and update stay in sync.
const ORGANIZATION_TYPE_VALUES = [
  "personal",
  "business",
  "nonprofit",
  "government",
  "demo",
  "internal",
  "environmental_planner",
] as const;

// A single email domain: a bare hostname like "usda.gov" or "sub.jacobs.com".
// The public-provider rejection and normalization live in the shared
// normalizeEmailDomains helper; this zod schema only guards the wire format.
const emailDomainSchema = z.string().regex(EMAIL_DOMAIN_REGEX);

const emailDomainsSchema = z.array(emailDomainSchema).max(20);

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

// Maximum number of redirect hops followed when fetching a logo. Redirects are
// resolved manually by the shared guard so every hop is re-validated.
const MAX_LOGO_REDIRECTS = 3;

const LOGO_FETCH_TIMEOUT_MS = 30_000;

// Fetch a logo image through the shared SSRF guard, then stream the body with a
// hard cap so a lying or absent Content-Length cannot force an over-cap buffer.
// Returns the raw bytes on success or a caller-safe error message on failure.
const buildLogoFetchUserAgent = (): string => {
  const { LANDING_URL } = getCommonEnv();
  const contact = LANDING_URL ? `; +${LANDING_URL}` : "";
  return `turboplan-catalog-mcp/1.0 (org logo fetch${contact})`;
};

const fetchLogoImage = async (
  initialUrl: string,
): Promise<{ bytes: Uint8Array } | { error: string }> => {
  const result = await fetchWithSsrfGuard(initialUrl, {
    label: "Logo URL",
    maxRedirects: MAX_LOGO_REDIRECTS,
    timeoutMs: LOGO_FETCH_TIMEOUT_MS,
    fetchFailureMessage: "Failed to fetch logo image from URL.",
    headers: {
      // Some hosts (e.g. Wikimedia) reject requests without a descriptive
      // User-Agent that carries contact info — so the deployment's public
      // URL rides along when configured.
      "User-Agent": buildLogoFetchUserAgent(),
    },
  });

  if (result.response === undefined) {
    return { error: result.error };
  }

  const response = result.response;

  if (!response.ok) {
    return { error: `URL returned HTTP ${response.status}.` };
  }

  // Fast-fail when the advertised size already exceeds the cap.
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_LOGO_SIZE) {
    return { error: "Logo image exceeds 2MB size limit." };
  }

  if (!response.body) {
    return { error: "Failed to fetch logo image from URL." };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      received += value.byteLength;
      if (received > MAX_LOGO_SIZE) {
        await reader.cancel().catch(() => {});
        return { error: "Logo image exceeds 2MB size limit." };
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => {});
    return { error: "Failed to fetch logo image from URL." };
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { bytes };
};

// Storage prefix mirrors the seed script
// (packages/core/turboplan-workspace/src/seed/organizations.ts) so app + public
// catalog rendering resolves MCP-uploaded logos identically to seeded ones.
const ORG_LOGOS_PREFIX = "org-logos";

export const registerOrganizationTools = (
  server: McpServer,
  user: McpUserContext,
) => {
  server.registerTool(
    "list_my_organizations",
    {
      description:
        "List all organizations you have access to, including public government organizations (read-only). Returns name, slug, type, and your role per organization.",
    },
    async () =>
      runWithWorkerConnection(async () => {
        const orgs = await getOrganizationsWithOffices(user.userId);

        const result = orgs.map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          shortName: org.shortName,
          hasAccess: org.hasAccess,
          officeCount: org.offices.length,
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
    "get_organization",
    {
      description:
        "Get details of a specific organization. Requires read access.",
      inputSchema: {
        organizationId: z.string().uuid().describe("Organization UUID"),
      },
    },
    async ({ organizationId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({ organizationId: entityIdSchema }),
          { organizationId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const org = await getOrganizationById(organizationId);
        const notFound = assertEntityExists(
          org,
          organizationId,
          "organization",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          organizationId,
          EntityType.ORGANIZATION,
          Action.READ,
          user.email,
        );
        if (denied) {
          return denied;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: org!.id,
                  name: org!.name,
                  slug: org!.slug,
                  shortName: org!.shortName,
                  description: org!.description,
                  type: org!.type,
                  status: org!.status,
                  country: org!.country,
                  logoUrl: org!.logoUrl,
                  coverImageId: org!.coverImageId,
                  emailDomains: org!.emailDomains,
                  catalogUrl: getOrganizationCatalogUrl(org!.slug),
                  dashboardUrl: getOrganizationDashboardUrl(org!.slug),
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
    "search_organizations",
    {
      description:
        "Search your accessible organizations by name. Returns matching organizations. Use limit to control result count (default 50, max 100).",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(100)
          .describe("Search query (name substring match)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max results to return (default 50)"),
      },
    },
    async ({ query, limit }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({ query: searchQuerySchema }),
          { query },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const maxResults = Math.min((limit as number) || 50, 100);
        const orgs = await getOrganizationsWithOffices(user.userId);
        const lowerQuery = query.toLowerCase();
        const allMatches = orgs.filter(
          (org) =>
            org.name.toLowerCase().includes(lowerQuery) ||
            (org.shortName && org.shortName.toLowerCase().includes(lowerQuery)),
        );
        const truncated = allMatches.length > maxResults;
        const matches = allMatches.slice(0, maxResults);

        const result = matches.map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          shortName: org.shortName,
          hasAccess: org.hasAccess,
          officeCount: org.offices.length,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  results: result,
                  totalMatches: allMatches.length,
                  ...(truncated && {
                    truncated: true,
                    hint: `Showing ${maxResults} of ${allMatches.length} matches. Use limit parameter to see more.`,
                  }),
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
    "create_organization",
    {
      description: "Create a new organization. Requires admin privileges.",
      inputSchema: {
        name: z.string().min(1).max(255).describe("Organization name"),
        shortName: z
          .string()
          .min(1)
          .max(50)
          .optional()
          .describe("Short name / abbreviation"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("Organization description"),
        type: z
          .enum(ORGANIZATION_TYPE_VALUES)
          .optional()
          .describe("Organization type (default: personal)"),
        status: z
          .enum(["active", "draft", "archived"])
          .optional()
          .describe("Organization status (default: active)"),
        country: z.string().min(1).max(100).optional().describe("Country name"),
        emailDomains: emailDomainsSchema
          .optional()
          .describe(
            'Email domains that auto-affiliate users with this org (e.g. ["jacobs.com"]). Public providers like gmail.com are rejected. Admin only.',
          ),
      },
    },
    async ({
      name,
      shortName,
      description,
      type,
      status,
      country,
      emailDomains,
    }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            name: nameSchema,
            shortName: shortNameSchema.optional(),
            description: descriptionSchema,
            type: z.enum(ORGANIZATION_TYPE_VALUES).optional(),
            status: z.enum(["active", "draft", "archived"]).optional(),
            country: z.string().min(1).max(100).optional(),
            emailDomains: emailDomainsSchema.optional(),
          }),
          { name, shortName, description, type, status, country, emailDomains },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const admin = await isAdmin(user.userId, user.email);
        if (!admin) {
          return accessDenied();
        }

        const validated = validation.data;

        // Normalize + reject public-provider email domains before writing.
        let cleanedEmailDomains: string[] | undefined;
        if (validated.emailDomains !== undefined) {
          const result = normalizeEmailDomains(validated.emailDomains);
          if (!result.ok) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: result.error }],
            };
          }
          cleanedEmailDomains = result.domains;
        }

        const org = await createOrganization({
          name: validated.name,
          ...(validated.shortName !== undefined && {
            shortName: validated.shortName,
          }),
          ...(validated.description !== undefined && {
            description: validated.description,
          }),
          ...(validated.type !== undefined && {
            type: validated.type as OrganizationType,
          }),
          ...(validated.status !== undefined && {
            status: validated.status as OrganizationStatus,
          }),
          ...(validated.country !== undefined && {
            country: validated.country,
          }),
          ...(cleanedEmailDomains !== undefined && {
            emailDomains: cleanedEmailDomains,
          }),
          createdBy: user.userId,
        });

        // Assign the creator as organization owner so the org resolves through
        // RBAC and appears in list_my_organizations for non-admin flows.
        await assignOrganizationOwner(user.userId, org.id);

        // Best-effort cover image — never throws, and a failure here must not
        // fail the organization creation.
        const coverImage = await generateOrganizationCoverImage(
          org.id,
          org.name,
          user.userId,
          org.description,
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  organization: {
                    id: org.id,
                    name: org.name,
                    slug: org.slug,
                    type: org.type,
                    status: org.status,
                    catalogUrl: getOrganizationCatalogUrl(org.slug),
                    dashboardUrl: getOrganizationDashboardUrl(org.slug),
                  },
                  coverImage,
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
    "update_organization",
    {
      description:
        "Update an organization's properties. Requires editor role or higher. Changing type or status requires platform-admin privileges; changing emailDomains requires organization owner (MANAGE_MEMBERS) privileges.",
      inputSchema: {
        organizationId: z.string().uuid().describe("Organization UUID"),
        name: z.string().min(1).max(255).optional().describe("New name"),
        shortName: z
          .string()
          .min(1)
          .max(50)
          .optional()
          .describe("New short name"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("New description"),
        type: z
          .enum(ORGANIZATION_TYPE_VALUES)
          .optional()
          .describe("Organization type (platform-admin only)"),
        status: z
          .enum(["active", "draft", "archived"])
          .optional()
          .describe("Organization status (platform-admin only)"),
        country: z.string().min(1).max(100).optional().describe("Country name"),
        emailDomains: emailDomainsSchema
          .optional()
          .describe(
            'Email domains that auto-affiliate users with this org (e.g. ["jacobs.com"]). Public providers like gmail.com are rejected. Requires organization owner (MANAGE_MEMBERS) privileges.',
          ),
      },
    },
    async ({
      organizationId,
      name,
      shortName,
      description,
      type,
      status,
      country,
      emailDomains,
    }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            organizationId: entityIdSchema,
            name: nameSchema.optional(),
            shortName: shortNameSchema.optional(),
            description: descriptionSchema,
            type: z.enum(ORGANIZATION_TYPE_VALUES).optional(),
            status: z.enum(["active", "draft", "archived"]).optional(),
            country: z.string().min(1).max(100).optional(),
            emailDomains: emailDomainsSchema.optional(),
          }),
          {
            organizationId,
            name,
            shortName,
            description,
            type,
            status,
            country,
            emailDomains,
          },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const org = await getOrganizationById(organizationId);
        const notFound = assertEntityExists(
          org,
          organizationId,
          "organization",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          organizationId,
          EntityType.ORGANIZATION,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        // Type and status control public cataloging, so they require
        // platform-admin privileges (org-level roles are not enough).
        const changesAdminFields =
          validated.type !== undefined || validated.status !== undefined;
        if (changesAdminFields) {
          const admin = await isAdmin(user.userId, user.email);
          if (!admin) {
            return accessDenied();
          }
        }

        // Email domains drive auto-affiliation, so changing them requires the
        // org-owner bar (MANAGE_MEMBERS). Platform admins still pass via the
        // RBAC adminCheck bypass inside assertPermission.
        if (validated.emailDomains !== undefined) {
          const deniedEmailDomains = await assertPermission(
            user.userId,
            organizationId,
            EntityType.ORGANIZATION,
            Action.MANAGE_MEMBERS,
            user.email,
          );
          if (deniedEmailDomains) {
            return deniedEmailDomains;
          }
        }

        // Normalize + reject public-provider email domains before writing.
        let cleanedEmailDomains: string[] | undefined;
        if (validated.emailDomains !== undefined) {
          const result = normalizeEmailDomains(validated.emailDomains);
          if (!result.ok) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: result.error }],
            };
          }
          cleanedEmailDomains = result.domains;
        }

        await updateOrganization({
          id: organizationId,
          ...(validated.name !== undefined && { name: validated.name }),
          ...(validated.shortName !== undefined && {
            shortName: validated.shortName,
          }),
          ...(validated.description !== undefined && {
            description: validated.description,
          }),
          ...(validated.type !== undefined && {
            type: validated.type as OrganizationType,
          }),
          ...(validated.status !== undefined && {
            status: validated.status as OrganizationStatus,
          }),
          ...(validated.country !== undefined && {
            country: validated.country,
          }),
          ...(cleanedEmailDomains !== undefined && {
            emailDomains: cleanedEmailDomains,
          }),
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, organizationId }, null, 2),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "upload_organization_logo_from_url",
    {
      description:
        "Set an organization's logo by fetching an image from a URL. The image is downloaded server-side (PNG, JPEG, WebP, or SVG without active content, max 2MB), stored in R2 storage, and set as the organization logo shown in-app and in the public catalog. Requires editor role or higher on the organization.",
      inputSchema: {
        organizationId: z.string().uuid().describe("Organization UUID"),
        url: z.string().url().describe("URL to fetch the logo image from"),
      },
    },
    async ({ organizationId, url }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            organizationId: entityIdSchema,
            url: z.string().url(),
          }),
          { organizationId, url },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const org = await getOrganizationById(organizationId);
        const notFound = assertEntityExists(
          org,
          organizationId,
          "organization",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          organizationId,
          EntityType.ORGANIZATION,
          Action.UPDATE,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        const fetchResult = await fetchLogoImage(validated.url);
        if ("error" in fetchResult) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: fetchResult.error }],
          };
        }

        // Resolve the type from the downloaded bytes and use the resolved MIME
        // for both the extension and the stored blob type — never the remote
        // header.
        const resolved = resolveLogoImageType(fetchResult.bytes);
        if (!resolved.ok) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text:
                  resolved.reason === "active-svg"
                    ? "SVG rejected: contains active content (scripts, event handlers, foreignObject, iframe/object/embed, processing instructions, non-raster data: URLs, or XML entities)."
                    : "Unsupported image type. Allowed: PNG, JPEG, WebP, SVG.",
              },
            ],
          };
        }
        const sniffed = resolved.type;

        const blobPath = `${ORG_LOGOS_PREFIX}/${organizationId}.${sniffed.extension}`;

        const { url: logoUrl } = await uploadFile(
          blobPath,
          fetchResult.bytes,
          sniffed.mime,
        );

        await updateOrganization({ id: organizationId, logoUrl });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, logoUrl }, null, 2),
            },
          ],
        };
      }),
  );
};
