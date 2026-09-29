import { generateText } from "ai";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  getTableColumns,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { getModel } from "@wildfires-org/turboplan-ai/server";
import { getPrompt } from "@wildfires-org/turboplan-ai/services";
import {
  assertCreditsAvailable,
  CreditsExhaustedError,
  meterAiCall,
  resolveBillingOrgForProject,
} from "@wildfires-org/turboplan-billing/server";
import type { NewEmptyStateSuggestion } from "@wildfires-org/turboplan-db";
import {
  document,
  emptyStateSuggestion,
  generatedImages,
  milestones,
  office,
  officeUsers,
  organization,
  organizationUsers,
  type Project,
  profile,
  project,
  projectDocument,
  projectField,
  projectUsers,
  tasks,
  user,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { EntityType } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";
import { isStorageUrl } from "@wildfires-org/turboplan-upload/server";
import {
  generateSlug,
  generateUniqueSlug,
  isValidSlug,
} from "@wildfires-org/turboplan-utils/server";

import type { SlugLookupResult } from "../../types";
import { getOfficeById } from "../offices/queries";
import { getOrganizationById } from "../organizations/queries";
import {
  isProjectDocumentInScope,
  resolveTemplateCopyScope,
} from "./template-copy-policy";
import type {
  CreateProjectRequest,
  ProjectStatus,
  ProjectWithCoverImage,
  UpdateProjectRequest,
  UserProject,
} from "./types";

export async function getProjectById(id: string): Promise<Project | null> {
  try {
    const [proj] = await db
      .select()
      .from(project)
      .where(and(eq(project.id, id), isNull(project.deletedAt)));
    return proj || null;
  } catch (error) {
    console.error("Failed to get project from database");
    throw error;
  }
}

// Image content types supported by both PDFKit and the docx generator. Logos in
// any other format are ignored rather than passed through and failing downstream.
const SUPPORTED_LETTERHEAD_CONTENT_TYPES = new Set(["image/png", "image/jpeg"]);

// Bound the fetch so a hostile or unhealthy URL can't hang the export request or
// exhaust memory. Logos live in our blob storage and are small.
const IMAGE_FETCH_TIMEOUT_MS = 5000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Download an image URL as raw bytes, guarding to the PNG/JPEG formats both the
 * PDF and docx generators accept.
 *
 * Only URLs that point at our own blob storage are fetched — arbitrary URLs are
 * refused so an org/office admin can't aim the server at internal hosts (SSRF).
 * The fetch is also bounded by a timeout and a max size.
 *
 * Returns null when the url is null, not a storage URL, the fetch fails or times
 * out, the body exceeds MAX_IMAGE_BYTES, or the resource is not a supported type.
 */
async function fetchImageBytes(
  url: string | null,
): Promise<{ data: Uint8Array; contentType: string } | null> {
  if (!url) {
    return null;
  }

  // SSRF guard: never fetch arbitrary, caller-supplied URLs — only our storage.
  if (!isStorageUrl(url)) {
    return null;
  }

  const res = await fetch(url, {
    signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    return null;
  }

  const contentType = res.headers.get("content-type")?.split(";")[0].trim();
  if (!contentType || !SUPPORTED_LETTERHEAD_CONTENT_TYPES.has(contentType)) {
    return null;
  }

  // Reject oversized payloads up front when the server declares a length.
  const declaredLength = Number(res.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    return null;
  }

  const data = new Uint8Array(await res.arrayBuffer());
  // Guard again after download for servers that omit/understate content-length.
  if (data.byteLength > MAX_IMAGE_BYTES) {
    return null;
  }

  return { data, contentType };
}

/**
 * Resolve the letterhead logo URL for a project.
 *
 * Resolution order: the owning office's `documentLogoUrl`, falling back to the
 * owning organization's `documentLogoUrl`. Returns null when the project is
 * invalid or neither entity has a document logo configured.
 */
export async function resolveProjectLetterheadLogoUrl(
  projectId: string,
): Promise<string | null> {
  const proj = await getProjectById(projectId);
  if (!proj) {
    return null;
  }

  const office = await getOfficeById(proj.officeId);
  if (!office) {
    return null;
  }

  if (office.documentLogoUrl) {
    return office.documentLogoUrl;
  }

  const org = await getOrganizationById(office.organizationId);
  return org?.documentLogoUrl ?? null;
}

/**
 * Resolve and download the letterhead logo for a project as raw bytes.
 *
 * Returns null when no logo is configured, the projectId is invalid, the fetch
 * fails, or the resolved resource is not a PNG/JPEG (the only formats both the
 * PDF and docx generators accept).
 */
export async function getProjectLetterheadLogo(
  projectId: string,
): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const url = await resolveProjectLetterheadLogoUrl(projectId);
    return await fetchImageBytes(url);
  } catch (error) {
    console.error("Failed to fetch project letterhead logo:", error);
    return null;
  }
}

/**
 * Resolve the document footer for a project: tagline text, right-aligned note,
 * and footer logo bytes.
 *
 * Each field resolves independently with office → org fallback (an office value
 * wins per-field; org fills the gaps). The logo is downloaded and guarded to the
 * PNG/JPEG formats both the PDF and docx generators accept. Returns nulls for
 * any field that is unset (or, for the logo, unreachable/unsupported).
 */
export async function getProjectFooter(projectId: string): Promise<{
  text: string | null;
  note: string | null;
  logo: { data: Uint8Array; contentType: string } | null;
}> {
  try {
    const proj = await getProjectById(projectId);
    if (!proj) {
      return { text: null, note: null, logo: null };
    }

    const office = await getOfficeById(proj.officeId);
    if (!office) {
      return { text: null, note: null, logo: null };
    }

    const org = await getOrganizationById(office.organizationId);

    const text = office.documentFooterText || org?.documentFooterText || null;
    const note = office.documentFooterNote || org?.documentFooterNote || null;
    const logoUrl =
      office.documentFooterLogoUrl || org?.documentFooterLogoUrl || null;

    const logo = await fetchImageBytes(logoUrl);

    return { text, note, logo };
  } catch (error) {
    console.error("Failed to fetch project footer:", error);
    return { text: null, note: null, logo: null };
  }
}

/**
 * Get project by slug (checks both current and historical slugs)
 * Returns the project and whether it was found via historical slug
 */
export async function getProjectBySlug(
  organizationSlug: string,
  officeSlug: string,
  projectSlug: string,
): Promise<SlugLookupResult<Project>> {
  try {
    const [result] = await db
      .select({ project })
      .from(project)
      .innerJoin(office, eq(project.officeId, office.id))
      .innerJoin(organization, eq(office.organizationId, organization.id))
      .where(
        and(
          eq(organization.slug, organizationSlug),
          eq(office.slug, officeSlug),
          isNull(project.deletedAt),
          or(
            eq(project.slug, projectSlug),
            sql`${project.slugHistory}::jsonb @> ${JSON.stringify([projectSlug])}::jsonb`,
          ),
        ),
      );

    if (!result?.project) {
      return { entity: null, foundViaHistory: false };
    }

    // Check if found via history (current slug doesn't match)
    const foundViaHistory = result.project.slug !== projectSlug;

    return { entity: result.project, foundViaHistory };
  } catch (error) {
    console.error("Failed to get project by slug from database");
    throw error;
  }
}

/**
 * Check if a project slug already exists within an office (in current slug or slugHistory)
 * Uses single query to check both. Optionally exclude a specific project ID (for updates)
 */
async function isProjectSlugTaken(
  officeId: string,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(project)
    .where(
      and(
        eq(project.officeId, officeId),
        or(
          eq(project.slug, slug),
          sql`${project.slugHistory}::jsonb @> ${JSON.stringify([slug])}::jsonb`,
        ),
      ),
    );

  if (existing && existing.id !== excludeId) {
    return true;
  }
  return false;
}

/**
 * Generate a unique slug for a project within an office
 * If the base slug is taken, appends a short unique ID
 */
export async function generateUniqueProjectSlug(
  officeId: string,
  name: string,
): Promise<string> {
  const baseSlug = generateSlug(name);

  if (!baseSlug) {
    return generateUniqueSlug(name);
  }

  const isTaken = await isProjectSlugTaken(officeId, baseSlug);
  if (!isTaken) {
    return baseSlug;
  }

  // Slug is taken, generate unique one
  return generateUniqueSlug(name);
}

/**
 * Fetch aggregated task counts (total and completed) for a list of project IDs.
 * Returns a Map keyed by projectId.
 */
async function getTaskCountsByProjectIds(
  projectIds: string[],
): Promise<Map<string, { total: number; completed: number }>> {
  if (projectIds.length === 0) {
    return new Map();
  }

  const counts = await db
    .select({
      projectId: milestones.projectId,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')::int`,
    })
    .from(tasks)
    .innerJoin(milestones, eq(tasks.milestoneId, milestones.id))
    .where(inArray(milestones.projectId, projectIds))
    .groupBy(milestones.projectId);

  return new Map(
    counts.map((c) => [
      c.projectId!,
      { total: c.total, completed: c.completed },
    ]),
  );
}

/**
 * Enrich an array of projects with taskCount and completedTaskCount fields.
 */
function enrichWithTaskCounts<T extends { id: string }>(
  projects: T[],
  countMap: Map<string, { total: number; completed: number }>,
): (T & { taskCount: number; completedTaskCount: number })[] {
  return projects.map((p) => ({
    ...p,
    taskCount: countMap.get(p.id)?.total ?? 0,
    completedTaskCount: countMap.get(p.id)?.completed ?? 0,
  }));
}

export async function getProjectsByOffice(
  officeId: string,
  options: {
    status?: ProjectStatus;
    isTemplate?: boolean;
    isPublic?: boolean;
    offset?: number;
    limit?: number;
    sortBy?: "name" | "createdAt" | "updatedAt" | "status";
    sortOrder?: "asc" | "desc";
  } = {},
): Promise<ProjectWithCoverImage[]> {
  try {
    // Build conditions
    const conditions = [
      eq(project.officeId, officeId),
      isNull(project.deletedAt),
    ];

    if (options.status) {
      conditions.push(eq(project.status, options.status));
    }

    if (typeof options.isTemplate === "boolean") {
      conditions.push(eq(project.isTemplate, options.isTemplate));
    }

    if (typeof options.isPublic === "boolean") {
      conditions.push(eq(project.isPublic, options.isPublic));
    }

    // Determine sorting
    const { sortBy = "createdAt", sortOrder = "desc" } = options;
    const sortFn = sortOrder === "asc" ? asc : desc;

    let orderByClause;
    switch (sortBy) {
      case "name":
        orderByClause = sortFn(project.name);
        break;
      case "status":
        orderByClause = sortFn(project.status);
        break;
      case "updatedAt":
        orderByClause = sortFn(project.updatedAt);
        break;
      default:
        orderByClause = sortFn(project.createdAt);
        break;
    }

    // Build the complete query with left join for cover image
    const baseQuery = db
      .select({
        ...getTableColumns(project),
        coverImageUrl: generatedImages.imageUrl,
        creatorFirstName: profile.firstName,
        creatorLastName: profile.lastName,
        creatorAvatarUrl: profile.avatarUrl,
        creatorEmail: user.email,
      })
      .from(project)
      .leftJoin(generatedImages, eq(project.coverImageId, generatedImages.id))
      .leftJoin(profile, eq(project.createdBy, profile.userId))
      .leftJoin(user, eq(project.createdBy, user.id))
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(orderByClause);

    // Apply pagination conditionally
    let projects;
    if (
      typeof options.offset === "number" &&
      typeof options.limit === "number"
    ) {
      projects = await baseQuery.offset(options.offset).limit(options.limit);
    } else if (typeof options.offset === "number") {
      projects = await baseQuery.offset(options.offset);
    } else if (typeof options.limit === "number") {
      projects = await baseQuery.limit(options.limit);
    } else {
      projects = await baseQuery;
    }

    // Enrich with task counts
    const projectIds = projects.map((p) => p.id);
    const countMap = await getTaskCountsByProjectIds(projectIds);
    return enrichWithTaskCounts(projects, countMap);
  } catch (error) {
    console.error("Failed to get projects by office from database");
    throw error;
  }
}

export async function getProjectsCreatedByUser(
  userId: string,
): Promise<UserProject[]> {
  try {
    const projects = await db
      .select({
        ...getTableColumns(project),
        coverImageUrl: generatedImages.imageUrl,
        creatorFirstName: profile.firstName,
        creatorLastName: profile.lastName,
        creatorAvatarUrl: profile.avatarUrl,
        creatorEmail: user.email,
        officeSlug: office.slug,
        officeName: office.name,
        orgSlug: organization.slug,
        orgName: organization.name,
      })
      .from(project)
      .innerJoin(office, eq(project.officeId, office.id))
      .innerJoin(organization, eq(office.organizationId, organization.id))
      .leftJoin(generatedImages, eq(project.coverImageId, generatedImages.id))
      .leftJoin(profile, eq(project.createdBy, profile.userId))
      .leftJoin(user, eq(project.createdBy, user.id))
      .where(
        and(
          eq(project.createdBy, userId),
          eq(project.isTemplate, false),
          isNull(project.deletedAt),
          or(
            exists(
              db
                .select({ one: sql`1` })
                .from(organizationUsers)
                .where(
                  and(
                    eq(organizationUsers.userId, userId),
                    eq(organizationUsers.organizationId, organization.id),
                  ),
                ),
            ),
            exists(
              db
                .select({ one: sql`1` })
                .from(officeUsers)
                .where(
                  and(
                    eq(officeUsers.userId, userId),
                    eq(officeUsers.officeId, project.officeId),
                  ),
                ),
            ),
            exists(
              db
                .select({ one: sql`1` })
                .from(projectUsers)
                .where(
                  and(
                    eq(projectUsers.userId, userId),
                    eq(projectUsers.projectId, project.id),
                  ),
                ),
            ),
          ),
        ),
      )
      .orderBy(desc(project.updatedAt));

    // Enrich with task counts
    const projectIds = projects.map((p) => p.id);
    const countMap = await getTaskCountsByProjectIds(projectIds);
    return enrichWithTaskCounts(projects, countMap);
  } catch (error) {
    console.error("Failed to get projects created by user from database");
    throw error;
  }
}

export async function createProject(
  data: CreateProjectRequest,
): Promise<Project> {
  try {
    return db.transaction(async (transaction) => {
      const now = new Date();

      // Calculate default end date (180 days from now)
      const defaultEndDate = new Date(now);
      defaultEndDate.setDate(defaultEndDate.getDate() + 180);

      // Create the project first
      const [newProject] = await transaction
        .insert(project)
        .values({
          name: data.name,
          slug: data.slug,
          description: data.description,
          prompt: data.prompt,
          officeId: data.officeId,
          createdBy: data.createdBy,
          lastModifiedBy: data.createdBy,
          isTemplate: data.isTemplate || false,
          isPublic: data.isPublic || false,
          parentProjectId: data.parentProjectId,
          status: data.status || "active",
          ...(data.ownershipStatus
            ? { ownershipStatus: data.ownershipStatus }
            : {}),
          ...(data.isResearchPhaseCompleted
            ? { isResearchPhaseCompleted: true }
            : {}),
          startDate: now,
          endDate: defaultEndDate,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Automatically assign the creator as owner in the join table
      await transaction.insert(projectUsers).values({
        userId: data.createdBy,
        projectId: newProject.id,
        role: "owner",
      });

      return newProject;
    });
  } catch (error) {
    console.error("Failed to create project in database:", error);
    throw error;
  }
}

export async function updateProject(data: UpdateProjectRequest): Promise<void> {
  try {
    // Validate slug format if provided
    if (data.slug !== undefined && !isValidSlug(data.slug)) {
      throw new Error(`Invalid slug format: "${data.slug}"`);
    }

    // Use transaction to prevent race conditions during slug updates
    await db.transaction(async (tx) => {
      const updateData: Partial<typeof project.$inferInsert> = {
        updatedAt: new Date(),
        lastModifiedBy: data.lastModifiedBy,
      };

      if (data.name !== undefined) {
        updateData.name = data.name;
      }

      if (data.description !== undefined) {
        updateData.description = data.description;
      }

      if (data.prompt !== undefined) {
        updateData.prompt = data.prompt;
      }

      if (data.isTemplate !== undefined) {
        updateData.isTemplate = data.isTemplate;
      }

      if (data.isPublic !== undefined) {
        updateData.isPublic = data.isPublic;
      }

      if (data.status !== undefined) {
        updateData.status = data.status;
      }

      if (data.startDate !== undefined) {
        updateData.startDate = data.startDate;
      }

      if (data.endDate !== undefined) {
        updateData.endDate = data.endDate;
      }

      // Handle slug change with history tracking
      if (data.slug !== undefined) {
        const [current] = await tx
          .select()
          .from(project)
          .where(and(eq(project.id, data.id), isNull(project.deletedAt)));

        if (current && current.slug !== data.slug) {
          // Check if new slug is available (excluding self)
          const isTaken = await isProjectSlugTaken(
            current.officeId,
            data.slug,
            data.id,
          );
          if (isTaken) {
            throw new Error(
              `Slug "${data.slug}" is already taken or was previously used`,
            );
          }

          // Add current slug to history (unless it's already there)
          const updatedHistory = current.slugHistory.includes(current.slug)
            ? current.slugHistory
            : [...current.slugHistory, current.slug];

          // Remove new slug from history if it exists (returning to a previous slug)
          const finalHistory = updatedHistory.filter((s) => s !== data.slug);

          updateData.slug = data.slug;
          updateData.slugHistory = finalHistory;
        } else if (current) {
          updateData.slug = data.slug;
        }
      }

      await tx
        .update(project)
        .set(updateData)
        .where(and(eq(project.id, data.id), isNull(project.deletedAt)));
    });
  } catch (error) {
    console.error("Failed to update project in database");
    throw error;
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await db.delete(project).where(eq(project.id, id));
  } catch (error) {
    console.error("Failed to delete project from database");
    throw error;
  }
}

export async function softDeleteProject(
  id: string,
  lastModifiedBy: string,
): Promise<void> {
  try {
    await db
      .update(project)
      .set({
        deletedAt: new Date(),
        status: "archived",
        lastModifiedBy,
        updatedAt: new Date(),
      })
      .where(and(eq(project.id, id), isNull(project.deletedAt)));
  } catch (error) {
    console.error("Failed to soft delete project from database");
    throw error;
  }
}

export async function getProjectWithRelations(id: string) {
  try {
    const result = await db
      .select({
        project: project,
        office: office,
        creator: user,
      })
      .from(project)
      .leftJoin(office, eq(project.officeId, office.id))
      .leftJoin(user, eq(project.createdBy, user.id))
      .where(and(eq(project.id, id), isNull(project.deletedAt)));

    return result[0] || null;
  } catch (error) {
    console.error("Failed to get project with relations from database");
    throw error;
  }
}

/**
 * Check if a user has access to a project
 * Uses the RBAC hierarchy so access inherited from organization or office
 * membership is respected, not just direct project membership.
 */
export async function checkUserProjectAccess(
  userId: string,
  projectId: string,
): Promise<boolean> {
  try {
    const projectExists = await db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, projectId), isNull(project.deletedAt)))
      .limit(1);

    if (projectExists.length === 0) {
      return false;
    }

    const rbacService = getRBACService();
    const role = await rbacService.getEffectiveRole(
      userId,
      projectId,
      EntityType.PROJECT,
    );
    return role !== null;
  } catch (error) {
    console.error("Failed to check user project access:", error);
    return false;
  }
}

/**
 * Get all projects a user has access to via RBAC for a given office
 * Includes projects where user has:
 * - Direct project membership
 * - Office membership (downward access to all projects in the office)
 * - Organization membership (downward access to all projects in all offices of the org)
 */
export async function getUserAccessibleProjects(
  userId: string,
  officeId: string,
): Promise<ProjectWithCoverImage[]> {
  try {
    // Run office lookup and memberships fetch in parallel
    const rbacService = getRBACService();
    const [officeData, allMemberships] = await Promise.all([
      db
        .select({
          office: office,
          organization: organization,
        })
        .from(office)
        .innerJoin(organization, eq(office.organizationId, organization.id))
        .where(eq(office.id, officeId))
        .limit(1),
      rbacService.getUserMemberships(userId),
    ]);

    if (officeData.length === 0) {
      return [];
    }

    const organizationId = officeData[0].organization.id;

    // Check if user has organization membership - if so, they can see all projects
    const hasOrgMembership = allMemberships.some(
      (m) =>
        m.entityId === organizationId &&
        m.entityType === EntityType.ORGANIZATION,
    );

    if (hasOrgMembership) {
      // User has organization access, return all projects in this office
      const allProjects = await getProjectsByOffice(officeId);
      return allProjects;
    }

    // Check if user has office membership - if so, they can see all projects in that office
    const hasOfficeMembership = allMemberships.some(
      (m) => m.entityId === officeId && m.entityType === EntityType.OFFICE,
    );

    if (hasOfficeMembership) {
      // User has office access, return all projects in this office
      return await getProjectsByOffice(officeId);
    }

    // Batch: Collect all direct project IDs
    const directProjectIds = allMemberships
      .filter((m) => m.entityType === EntityType.PROJECT)
      .map((m) => m.entityId);

    // Single query: Fetch all direct projects and filter by office
    if (directProjectIds.length === 0) {
      return [];
    }

    const projects = await db
      .select({
        ...getTableColumns(project),
        coverImageUrl: generatedImages.imageUrl,
        creatorFirstName: profile.firstName,
        creatorLastName: profile.lastName,
        creatorAvatarUrl: profile.avatarUrl,
        creatorEmail: user.email,
      })
      .from(project)
      .leftJoin(generatedImages, eq(project.coverImageId, generatedImages.id))
      .leftJoin(profile, eq(project.createdBy, profile.userId))
      .leftJoin(user, eq(project.createdBy, user.id))
      .where(
        and(
          inArray(project.id, directProjectIds),
          eq(project.officeId, officeId),
          isNull(project.deletedAt),
        ),
      );

    // Enrich with task counts
    const projectIds = projects.map((p) => p.id);
    const countMap = await getTaskCountsByProjectIds(projectIds);
    return enrichWithTaskCounts(projects, countMap);
  } catch (error) {
    console.error("Failed to get accessible projects from database:", error);
    throw error;
  }
}

async function copyProjectContentToTarget(
  tx: typeof db,
  sourceProjectId: string,
  targetProjectId: string,
  userId: string,
  options?: {
    dateOffsetMs?: number;
    /** Module names whose content must not be copied (see template-copy-policy). */
    excludedModules?: readonly string[];
  },
): Promise<void> {
  const dateOffsetMs = options?.dateOffsetMs ?? 0;
  const scope = resolveTemplateCopyScope(options?.excludedModules);
  const shiftDate = (date: Date): Date =>
    new Date(date.getTime() + dateOffsetMs);

  // Copy project fields
  const sourceFields = scope.fields
    ? await tx
        .select()
        .from(projectField)
        .where(eq(projectField.projectId, sourceProjectId))
    : [];

  if (sourceFields.length > 0) {
    await tx.insert(projectField).values(
      sourceFields.map((f) => ({
        projectId: targetProjectId,
        name: f.name,
        type: f.type,
        isRequired: f.isRequired,
        tooltip: f.tooltip,
        order: f.order,
        values: f.values,
      })),
    );
  }

  // Fetch milestones/tasks from source
  const sourceMilestones = scope.tasks
    ? await tx
        .select()
        .from(milestones)
        .where(eq(milestones.projectId, sourceProjectId))
    : [];

  const sourceTasks =
    sourceMilestones.length > 0
      ? await tx
          .select()
          .from(tasks)
          .where(
            inArray(
              tasks.milestoneId,
              sourceMilestones.map((m) => m.id),
            ),
          )
      : [];

  // Copy referenced docs and remap IDs
  const documentIdMap = new Map<string, string>();
  const uniqueDocumentIds = new Set<string>();

  for (const m of sourceMilestones) {
    if (m.documentId) uniqueDocumentIds.add(m.documentId);
  }
  for (const t of sourceTasks) {
    if (t.documentId) uniqueDocumentIds.add(t.documentId);
  }

  for (const docId of uniqueDocumentIds) {
    const [latestDoc] = await tx
      .select()
      .from(document)
      .where(eq(document.id, docId))
      .orderBy(desc(document.createdAt))
      .limit(1);

    if (latestDoc) {
      const [newDoc] = await tx
        .insert(document)
        .values({
          createdAt: new Date(),
          title: latestDoc.title,
          content: latestDoc.content,
          kind: latestDoc.kind,
          userId,
        })
        .returning();
      documentIdMap.set(docId, newDoc.id);
    }
  }

  // Copy milestones and keep ID map for tasks
  const milestoneIdMap = new Map<string, string>();

  for (const src of sourceMilestones) {
    const [inserted] = await tx
      .insert(milestones)
      .values({
        title: src.title,
        assigneeIds: [],
        startDate: shiftDate(src.startDate),
        dueDate: shiftDate(src.dueDate),
        status: src.status,
        order: src.order,
        documentId: src.documentId
          ? (documentIdMap.get(src.documentId) ?? src.documentId)
          : src.documentId,
        projectId: targetProjectId,
        userId,
      })
      .returning();
    milestoneIdMap.set(src.id, inserted.id);
  }

  // Copy tasks in two passes so dependencies are remapped correctly
  const taskIdMap = new Map<string, string>();
  for (const src of sourceTasks) {
    const [inserted] = await tx
      .insert(tasks)
      .values({
        title: src.title,
        description: src.description,
        assigneeIds: [],
        dependencies: [],
        startDate: shiftDate(src.startDate),
        dueDate: shiftDate(src.dueDate),
        status: src.status,
        order: src.order,
        milestoneId: milestoneIdMap.get(src.milestoneId) ?? src.milestoneId,
        documentId: src.documentId
          ? (documentIdMap.get(src.documentId) ?? src.documentId)
          : src.documentId,
        userId,
      })
      .returning();
    taskIdMap.set(src.id, inserted.id);
  }

  for (const sourceTask of sourceTasks) {
    if (!sourceTask.dependencies || sourceTask.dependencies.length === 0) {
      continue;
    }

    const newTaskId = taskIdMap.get(sourceTask.id);
    const remappedDeps = sourceTask.dependencies
      .map((depId) => taskIdMap.get(depId))
      .filter((id): id is string => id !== undefined);

    if (newTaskId && remappedDeps.length > 0) {
      await tx
        .update(tasks)
        .set({ dependencies: remappedDeps })
        .where(eq(tasks.id, newTaskId));
    }
  }

  // Copy project documents (share blob URLs)
  const sourceDocuments = (
    await tx
      .select()
      .from(projectDocument)
      .where(eq(projectDocument.projectId, sourceProjectId))
  ).filter((d) => isProjectDocumentInScope(d.source, scope));

  if (sourceDocuments.length > 0) {
    await tx.insert(projectDocument).values(
      sourceDocuments.map((d) => ({
        projectId: targetProjectId,
        userId,
        filename: d.filename,
        originalFilename: d.originalFilename,
        mimeType: d.mimeType,
        size: d.size,
        url: d.url,
        // Preserve origin + research metadata so duplicated research docs stay
        // on the Context page (not the Documents page).
        source: d.source,
        relevance: d.relevance,
        context: d.context,
        folder: d.folder,
        folderDescription: d.folderDescription,
      })),
    );
  }
}

/**
 * Create a template from an existing project by duplicating core project data.
 */
export async function createTemplateFromProject(
  sourceProjectId: string,
  userId: string,
  isPublic: boolean,
  overrides?: { name?: string; description?: string },
): Promise<Project> {
  try {
    return db.transaction(async (tx) => {
      const [sourceProject] = await tx
        .select()
        .from(project)
        .where(and(eq(project.id, sourceProjectId), isNull(project.deletedAt)));

      if (!sourceProject) {
        throw new Error(`Source project ${sourceProjectId} not found`);
      }

      const templateName = overrides?.name || `Template: ${sourceProject.name}`;
      const slug = await generateUniqueProjectSlug(
        sourceProject.officeId,
        templateName,
      );

      const now = new Date();
      const [newTemplate] = await tx
        .insert(project)
        .values({
          name: templateName,
          slug,
          description: overrides?.description ?? sourceProject.description,
          officeId: sourceProject.officeId,
          createdBy: userId,
          lastModifiedBy: userId,
          isTemplate: true,
          parentProjectId: sourceProjectId,
          isPublic,
          status: sourceProject.status,
          hiddenModules: sourceProject.hiddenModules,
          privateModules: sourceProject.privateModules,
          moduleOrder: sourceProject.moduleOrder,
          startDate: sourceProject.startDate,
          endDate: sourceProject.endDate,
          coverImageId: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await tx.insert(projectUsers).values({
        userId,
        projectId: newTemplate.id,
        role: "owner",
      });

      await copyProjectContentToTarget(
        tx,
        sourceProjectId,
        newTemplate.id,
        userId,
      );

      return newTemplate;
    });
  } catch (error) {
    console.error("Failed to create template from project:", error);
    throw error;
  }
}

export async function getEmptyStateSuggestions({
  projectId,
  section,
}: {
  projectId: string;
  section: "tasks" | "documents";
}) {
  return db
    .select()
    .from(emptyStateSuggestion)
    .where(
      and(
        eq(emptyStateSuggestion.projectId, projectId),
        eq(emptyStateSuggestion.section, section),
      ),
    )
    .orderBy(asc(emptyStateSuggestion.orderIndex));
}

export async function saveEmptyStateSuggestions(
  suggestions: NewEmptyStateSuggestion[],
) {
  return db.insert(emptyStateSuggestion).values(suggestions).returning();
}

export async function getOrGenerateEmptyStateSuggestions({
  projectId,
  section,
}: {
  projectId: string;
  section: "tasks" | "documents";
}) {
  const existing = await getEmptyStateSuggestions({ projectId, section });

  if (existing.length > 0) {
    return existing;
  }

  const proj = await getProjectById(projectId);
  if (!proj) {
    throw new Error("Project not found");
  }

  // Credit gate: garnish content — a hard-stopped org gets no suggestions
  // instead of a free model call.
  const billingOrgId = await resolveBillingOrgForProject(projectId);
  if (billingOrgId) {
    try {
      await assertCreditsAvailable(billingOrgId);
    } catch (error) {
      if (error instanceof CreditsExhaustedError) {
        return [];
      }
      throw error;
    }
  }

  const model = await getModel("lite");

  const sanitize = (input: string) =>
    input.replace(/[[\]{}]/g, "").slice(0, 200);

  const systemPrompt = await getPrompt("empty-state-suggestions", {
    section,
    projectName: sanitize(proj.name),
    projectDescription: sanitize(proj.description || "No description provided"),
  });

  const generation = await generateText({
    model,
    system: systemPrompt,
    prompt: `Generate 3 suggestion pills for the "${section}" section.`,
  });
  const suggestionsText = generation.text;

  await meterAiCall({
    billing: billingOrgId ? { organizationId: billingOrgId } : null,
    source: "suggestion",
    usage: generation.usage,
    providerMetadata: generation.providerMetadata,
    metadata: { tool: "emptyStateSuggestions", projectId, section },
  });

  let parsed: unknown;
  try {
    const cleaned = suggestionsText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error(
      "[empty-state-suggestions] Failed to parse AI response:",
      suggestionsText,
    );
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.error(
      "[empty-state-suggestions] Invalid suggestions structure:",
      parsed,
    );
    return [];
  }

  const suggestions = parsed
    .filter(
      (s): s is { label: string; content: string } =>
        typeof s === "object" &&
        s !== null &&
        typeof s.label === "string" &&
        typeof s.content === "string" &&
        s.label.length > 0 &&
        s.content.length > 0,
    )
    .slice(0, 3);

  if (suggestions.length === 0) {
    console.error(
      "[empty-state-suggestions] No valid suggestions in response:",
      parsed,
    );
    return [];
  }

  // Re-check for duplicates before inserting (guards against concurrent requests)
  const recheck = await getEmptyStateSuggestions({ projectId, section });
  if (recheck.length > 0) {
    return recheck;
  }

  const saved = await saveEmptyStateSuggestions(
    suggestions.map((s, index) => ({
      projectId,
      section,
      label: s.label,
      content: s.content,
      orderIndex: index,
    })),
  );

  return saved;
}
/**
 * Create a project from an existing template by duplicating core template data.
 */
export async function createProjectFromTemplate(
  templateProjectId: string,
  userId: string,
  targetOfficeId: string,
  overrides?: {
    name?: string;
    description?: string;
    /** Saved default submit-for-review target (not submitted at creation). */
    intendedSubmissionOrganizationId?: string | null;
    intendedSubmissionOfficeId?: string | null;
    /**
     * Module names whose content must not be copied — the template's
     * hidden/private modules when the caller reached it only because it is
     * public (no project role).
     */
    excludedModules?: readonly string[];
  },
): Promise<Project> {
  try {
    return db.transaction(async (tx) => {
      const [sourceTemplate] = await tx
        .select()
        .from(project)
        .where(
          and(eq(project.id, templateProjectId), isNull(project.deletedAt)),
        );

      if (!sourceTemplate) {
        throw new Error(`Template ${templateProjectId} not found`);
      }

      if (!sourceTemplate.isTemplate) {
        throw new Error(`Project ${templateProjectId} is not a template`);
      }

      const normalizedTemplateName = sourceTemplate.name
        .replace(/^Template:\s*/i, "")
        .trim();
      const projectName =
        overrides?.name?.trim() ||
        normalizedTemplateName ||
        sourceTemplate.name;
      const slug = await generateUniqueProjectSlug(targetOfficeId, projectName);

      const now = new Date();
      const templateStartDate =
        sourceTemplate.startDate ?? sourceTemplate.createdAt;
      const templateEndDate =
        sourceTemplate.endDate ??
        sourceTemplate.startDate ??
        sourceTemplate.createdAt;
      const templateDurationMs = Math.max(
        0,
        templateEndDate.getTime() - templateStartDate.getTime(),
      );
      const shiftedProjectStartDate = now;
      const shiftedProjectEndDate = new Date(
        now.getTime() + templateDurationMs,
      );
      const dateOffsetMs =
        shiftedProjectStartDate.getTime() - templateStartDate.getTime();

      const [newProject] = await tx
        .insert(project)
        .values({
          name: projectName,
          slug,
          description: overrides?.description ?? sourceTemplate.description,
          officeId: targetOfficeId,
          createdBy: userId,
          lastModifiedBy: userId,
          isTemplate: false,
          parentProjectId: templateProjectId,
          isPublic: false,
          status: sourceTemplate.status,
          hiddenModules: sourceTemplate.hiddenModules,
          privateModules: sourceTemplate.privateModules,
          moduleOrder: sourceTemplate.moduleOrder,
          startDate: shiftedProjectStartDate,
          endDate: shiftedProjectEndDate,
          coverImageId: null,
          intendedSubmissionOrganizationId:
            overrides?.intendedSubmissionOrganizationId ?? null,
          intendedSubmissionOfficeId:
            overrides?.intendedSubmissionOfficeId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await tx.insert(projectUsers).values({
        userId,
        projectId: newProject.id,
        role: "owner",
      });

      await copyProjectContentToTarget(
        tx,
        templateProjectId,
        newProject.id,
        userId,
        { dateOffsetMs, excludedModules: overrides?.excludedModules },
      );

      return newProject;
    });
  } catch (error) {
    console.error("Failed to create project from template:", error);
    throw error;
  }
}
