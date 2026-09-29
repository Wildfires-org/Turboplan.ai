/**
 * Fill an existing project with realistic demo data (USFS vegetation
 * restoration CE — Jackson Creek, Cleveland NF) so every module renders
 * populated: fields, milestones/tasks (Gantt), timeline, comments, documents,
 * map layers and project context.
 *
 * Usage (from apps/turboplan, so the dev DB/R2 env is loaded):
 *
 *   pnpm exec tsx --env-file=.env.local ../../e2e/scripts/seed-demo-project.ts \
 *     <orgSlug> <officeSlug> <projectSlug> [flags]
 *
 * Flags:
 *   --clean                     remove previously seeded rows and exit
 *   --fixtures-only             only (re)generate e2e/fixtures/demo-project/*
 *   --skip-uploads              skip documents (no R2 writes)
 *   --allow-remote-db=<host>    permit a non-localhost DB whose host matches exactly
 *
 * Idempotent: seeded rows are identified by their title/name/label/content
 * (see demo-project/content.ts) or a `demoSeed` timeline metadata flag, deleted,
 * then re-created — running twice leaves one copy.
 *
 * Side effects deliberately avoided: no emails or notifications (services are
 * called directly, not the routers that notify), no LLM/paid API calls, no
 * membership changes, no analytics hooks (the timeline recorder's analytics
 * handler is only configured inside the API server).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import {
  comment,
  layers,
  milestones,
  office,
  organization,
  profile,
  project,
  projectContext,
  projectDocument,
  projectField,
  projectUsers,
  tasks,
  timelineRecord,
  user,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { createComment } from "@wildfires-org/turboplan-db/queries";
import { getDbEnv } from "@wildfires-org/turboplan-env";

import {
  COMMENTER,
  DEMO_COMMENTS,
  DEMO_CONTEXT,
  DEMO_DOCUMENTS,
  DEMO_FIELDS,
  DEMO_MILESTONES,
  DEMO_TIMELINE_EVENTS,
  PROJECT_DESCRIPTION,
  PROJECT_END,
  PROJECT_START,
} from "./demo-project/content";
import {
  type DemoFixtures,
  LAYER_FILES,
  writeDemoFixtures,
} from "./demo-project/fixtures";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const SEED_METADATA = { demoSeed: true } as const;
const R2_KEY_PREFIX = "demo-seed-";

// ---------------------------------------------------------------------------
// Workspace packages the e2e package does not depend on are resolved through
// apps/server (which depends on all of them), so the script uses the exact
// same built modules as the running API without adding e2e dependencies.
// ---------------------------------------------------------------------------

const serverRequire = createRequire(
  path.join(REPO_ROOT, "apps/server/package.json"),
);

// biome-ignore lint/suspicious/noExplicitAny: modules resolved at runtime
const importFromServer = async (specifier: string): Promise<any> =>
  import(pathToFileURL(serverRequire.resolve(specifier)).href);

const loadModules = async () => {
  const [tasksPkg, mapPkg, fieldsPkg, timelinePkg, contextPkg, uploadPkg] =
    await Promise.all([
      importFromServer("@wildfires-org/turboplan-tasks/server"),
      importFromServer("@wildfires-org/turboplan-map/server"),
      importFromServer("@wildfires-org/turboplan-fields/server"),
      importFromServer("@wildfires-org/turboplan-timeline-records/server"),
      importFromServer("@wildfires-org/turboplan-project-context/server"),
      importFromServer("@wildfires-org/turboplan-upload/server"),
    ]);
  return { tasksPkg, mapPkg, fieldsPkg, timelinePkg, contextPkg, uploadPkg };
};

type Modules = Awaited<ReturnType<typeof loadModules>>;

type SeedTarget = {
  projectId: string;
  projectName: string;
  ownerId: string;
  ownerEmail: string;
};

// ---------------------------------------------------------------------------
// CLI + safety
// ---------------------------------------------------------------------------

const parseArgs = () => {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
  const allowRemote = flags
    .find((f) => f.startsWith("--allow-remote-db="))
    ?.split("=")[1];
  return {
    orgSlug: positional[0],
    officeSlug: positional[1],
    projectSlug: positional[2],
    isClean: flags.includes("--clean"),
    isFixturesOnly: flags.includes("--fixtures-only"),
    isSkipUploads: flags.includes("--skip-uploads"),
    allowRemoteHost: allowRemote,
  };
};

const assertSafeDatabase = (allowRemoteHost: string | undefined) => {
  const host = new URL(getDbEnv().POSTGRES_URL).hostname;
  if (LOCAL_DB_HOSTS.has(host)) {
    return host;
  }
  if (allowRemoteHost && allowRemoteHost === host) {
    console.warn(
      `! Writing to NON-LOCAL database host ${host} (explicitly allowed)`,
    );
    return host;
  }
  throw new Error(
    `Refusing to seed: database host "${host}" is not localhost. If this is a dev database, re-run with --allow-remote-db=${host}`,
  );
};

const resolveTarget = async (
  orgSlug: string,
  officeSlug: string,
  projectSlug: string,
): Promise<SeedTarget> => {
  const [row] = await db
    .select({
      projectId: project.id,
      projectName: project.name,
      createdBy: project.createdBy,
    })
    .from(project)
    .innerJoin(office, eq(office.id, project.officeId))
    .innerJoin(organization, eq(organization.id, office.organizationId))
    .where(
      and(
        eq(organization.slug, orgSlug),
        eq(office.slug, officeSlug),
        eq(project.slug, projectSlug),
        isNull(project.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    throw new Error(
      `Project ${orgSlug}/${officeSlug}/${projectSlug} not found`,
    );
  }

  const [owner] = await db
    .select({ id: user.id, email: user.email })
    .from(projectUsers)
    .innerJoin(user, eq(user.id, projectUsers.userId))
    .where(
      and(
        eq(projectUsers.projectId, row.projectId),
        eq(projectUsers.role, "owner"),
      ),
    )
    .limit(1);

  const ownerId = owner?.id ?? row.createdBy;
  const ownerEmail =
    owner?.email ??
    (
      await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, ownerId))
    )[0].email;

  return {
    projectId: row.projectId,
    projectName: row.projectName,
    ownerId,
    ownerEmail,
  };
};

// ---------------------------------------------------------------------------
// Cleanup (idempotency)
// ---------------------------------------------------------------------------

const cleanSeededData = async (target: SeedTarget, modules: Modules) => {
  const { projectId } = target;
  const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id);

  const milestoneIds = ids(
    await db
      .select({ id: milestones.id })
      .from(milestones)
      .where(
        and(
          eq(milestones.projectId, projectId),
          inArray(
            milestones.title,
            DEMO_MILESTONES.map((m) => m.title),
          ),
        ),
      ),
  );
  const taskIds =
    milestoneIds.length > 0
      ? ids(
          await db
            .select({ id: tasks.id })
            .from(tasks)
            .where(inArray(tasks.milestoneId, milestoneIds)),
        )
      : [];
  const fieldIds = ids(
    await db
      .select({ id: projectField.id })
      .from(projectField)
      .where(
        and(
          eq(projectField.projectId, projectId),
          inArray(
            projectField.name,
            DEMO_FIELDS.map((f) => f.name),
          ),
        ),
      ),
  );
  const contextIds = ids(
    await db
      .select({ id: projectContext.id })
      .from(projectContext)
      .where(
        and(
          eq(projectContext.projectId, projectId),
          inArray(
            projectContext.label,
            DEMO_CONTEXT.map((c) => c.label),
          ),
        ),
      ),
  );
  const documents = await db
    .select({ id: projectDocument.id, url: projectDocument.url })
    .from(projectDocument)
    .where(
      and(
        eq(projectDocument.projectId, projectId),
        inArray(
          projectDocument.originalFilename,
          DEMO_DOCUMENTS.map((d) => d.filename),
        ),
      ),
    );
  const commentIds = ids(
    await db
      .select({ id: comment.id })
      .from(comment)
      .where(
        and(
          eq(comment.projectId, projectId),
          inArray(
            comment.content,
            DEMO_COMMENTS.map((c) => c.content),
          ),
        ),
      ),
  );
  const layerIds = ids(
    await db
      .select({ id: layers.id })
      .from(layers)
      .where(
        and(
          eq(layers.projectId, projectId),
          inArray(layers.sourceFilename, Object.values(LAYER_FILES)),
        ),
      ),
  );

  const entityIds = [
    ...milestoneIds,
    ...taskIds,
    ...fieldIds,
    ...contextIds,
    ...ids(documents),
    ...commentIds,
    ...layerIds,
  ];

  const deletedTimeline = await db
    .delete(timelineRecord)
    .where(
      and(
        eq(timelineRecord.projectId, projectId),
        or(
          sql`${timelineRecord.metadata}->>'demoSeed' = 'true'`,
          entityIds.length > 0
            ? inArray(timelineRecord.entityId, entityIds)
            : sql`false`,
        ),
      ),
    )
    .returning({ id: timelineRecord.id });

  if (milestoneIds.length > 0) {
    // Tasks cascade with their milestone.
    await db.delete(milestones).where(inArray(milestones.id, milestoneIds));
  }
  if (fieldIds.length > 0) {
    await db.delete(projectField).where(inArray(projectField.id, fieldIds));
  }
  if (contextIds.length > 0) {
    await db
      .delete(projectContext)
      .where(inArray(projectContext.id, contextIds));
  }
  if (documents.length > 0) {
    await db
      .delete(projectDocument)
      .where(inArray(projectDocument.id, ids(documents)));
  }
  if (commentIds.length > 0) {
    await db.delete(comment).where(inArray(comment.id, commentIds));
  }
  if (layerIds.length > 0) {
    // Features cascade with their layer.
    await db.delete(layers).where(inArray(layers.id, layerIds));
  }

  console.log(
    `  cleaned: ${milestoneIds.length} milestones, ${taskIds.length} tasks, ${fieldIds.length} fields, ${contextIds.length} context, ${documents.length} documents, ${commentIds.length} comments, ${layerIds.length} layers, ${deletedTimeline.length} timeline records`,
  );

  return {
    documentUrls: documents.map((d) => d.url),
    deleteStorageObjects: async () => {
      for (const { url } of documents) {
        if (url.includes(`/${R2_KEY_PREFIX}`)) {
          await modules.uploadPkg.deleteFile(url);
        }
      }
    },
  };
};

// ---------------------------------------------------------------------------
// Seeders
// ---------------------------------------------------------------------------

const seedProjectMeta = async (target: SeedTarget, modules: Modules) => {
  const { computeChanges, createTimelineRecord, projectFieldDefs } =
    modules.timelinePkg;
  const [before] = await db
    .select()
    .from(project)
    .where(eq(project.id, target.projectId));

  const [after] = await db
    .update(project)
    .set({
      description: before.description ?? PROJECT_DESCRIPTION,
      startDate: new Date(`${PROJECT_START}T08:00:00`),
      endDate: new Date(`${PROJECT_END}T17:00:00`),
      lastModifiedBy: target.ownerId,
      updatedAt: new Date(),
    })
    .where(eq(project.id, target.projectId))
    .returning();

  const changes = computeChanges(before, after, projectFieldDefs);
  if (changes.length > 0) {
    // Mirrors PATCH /projects/:id. Not tagged as seeded: re-runs produce no
    // diff, so no duplicate is written, and --clean leaves the project's
    // dates/description as they are.
    await createTimelineRecord({
      projectId: target.projectId,
      userId: target.ownerId,
      entityType: "project",
      entityId: target.projectId,
      entityName: after.name,
      action: "updated",
      changes,
    });
  }
  return changes.length;
};

const seedFields = async (target: SeedTarget, modules: Modules) => {
  let count = 0;
  for (const field of DEMO_FIELDS) {
    const created = await modules.fieldsPkg.createProjectFieldEntry({
      projectId: target.projectId,
      name: field.name,
      type: field.type,
      values: field.values,
      userId: target.ownerId,
    });
    if (created) {
      count++;
    }
  }
  return count;
};

const seedContext = async (target: SeedTarget, modules: Modules) => {
  const created = await modules.contextPkg.insertProjectContext(
    target.projectId,
    DEMO_CONTEXT,
    target.ownerId,
  );
  return created.length;
};

const seedDocuments = async (
  target: SeedTarget,
  modules: Modules,
  fixtures: DemoFixtures,
) => {
  const { uploadFile } = modules.uploadPkg;
  const { createTimelineRecord } = modules.timelinePkg;
  const idsByFilename = new Map<string, string>();

  for (const doc of fixtures.documents) {
    const storedName = `${R2_KEY_PREFIX}${doc.filename
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")}`;
    // Same `uploads/{userId}/` prefix as presigned uploads, so the app treats
    // the object as owned by the project owner (e.g. delete removes it).
    const { url } = await uploadFile(
      `uploads/${target.ownerId}/${storedName}`,
      doc.data,
      doc.mimeType,
    );

    const [created] = await db
      .insert(projectDocument)
      .values({
        projectId: target.projectId,
        userId: target.ownerId,
        filename: storedName,
        originalFilename: doc.filename,
        mimeType: doc.mimeType,
        size: doc.data.length,
        url,
        source: "upload",
      })
      .returning();

    // Mirrors POST /project-documents.
    await createTimelineRecord({
      projectId: target.projectId,
      userId: target.ownerId,
      entityType: "document",
      entityId: created.id,
      entityName: created.originalFilename,
      action: "created",
      resourceUrls: [
        {
          url: created.url,
          filename: created.originalFilename,
          type: created.mimeType,
        },
      ],
      metadata: SEED_METADATA,
    });
    idsByFilename.set(doc.filename, created.id);
  }
  return idsByFilename;
};

const toDate = (day: string, hour: number) =>
  new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`);

const seedSchedule = async (
  target: SeedTarget,
  modules: Modules,
  documentIds: Map<string, string>,
) => {
  const {
    DrizzleMilestoneRepository,
    DrizzleTaskRepository,
    MilestoneService,
    TaskService,
  } = modules.tasksPkg;
  const { computeChanges, createTimelineRecord, taskFieldDefs } =
    modules.timelinePkg;

  const milestoneRepository = new DrizzleMilestoneRepository();
  const taskRepository = new DrizzleTaskRepository();
  const milestoneService = new MilestoneService(milestoneRepository);
  milestoneService.setTaskRepository(taskRepository);
  const taskService = new TaskService(
    taskRepository,
    milestoneRepository,
    milestoneService,
  );

  const taskIdsByTitle = new Map<string, string>();
  let taskCount = 0;

  for (const demoMilestone of DEMO_MILESTONES) {
    // `documentId` is the project id for tasks/milestones.
    const milestone = await milestoneService.createMilestone({
      title: demoMilestone.title,
      assigneeIds: [target.ownerId],
      startDate: toDate(demoMilestone.start, 8),
      dueDate: toDate(demoMilestone.due, 17),
      documentId: target.projectId,
      projectId: target.projectId,
      userId: target.ownerId,
    });
    await createTimelineRecord({
      projectId: target.projectId,
      userId: target.ownerId,
      entityType: "milestone",
      entityId: milestone.id,
      entityName: milestone.title,
      action: "created",
      metadata: SEED_METADATA,
    });

    for (const demoTask of demoMilestone.tasks) {
      // Completed/delayed tasks start "in progress" and are then moved to
      // their final status, so the timeline shows a real status change.
      const hasStatusChange =
        demoTask.status === "completed" || demoTask.status === "delayed";
      const task = await taskService.createTask({
        title: demoTask.title,
        description: demoTask.description,
        assigneeIds: [target.ownerId],
        dependencies: (demoTask.dependsOn ?? []).map((title) => {
          const id = taskIdsByTitle.get(title);
          if (!id) {
            throw new Error(
              `Unknown dependency "${title}" for "${demoTask.title}"`,
            );
          }
          return id;
        }),
        projectDocumentIds: (demoTask.documents ?? [])
          .map((filename) => documentIds.get(filename))
          .filter((id): id is string => Boolean(id)),
        status: hasStatusChange ? "in_progress" : demoTask.status,
        milestoneId: milestone.id,
        startDate: toDate(demoTask.start, 8),
        dueDate: toDate(demoTask.due, 17),
        documentId: target.projectId,
        userId: target.ownerId,
      });
      await createTimelineRecord({
        projectId: target.projectId,
        userId: target.ownerId,
        entityType: "task",
        entityId: task.id,
        entityName: task.title,
        action: "created",
        metadata: { ...SEED_METADATA, milestoneId: milestone.id },
      });

      if (hasStatusChange) {
        const updated = await taskService.updateTask(task.id, {
          status: demoTask.status,
        });
        const changes = computeChanges(task, updated, taskFieldDefs);
        if (changes.length > 0) {
          await createTimelineRecord({
            projectId: target.projectId,
            userId: target.ownerId,
            entityType: "task",
            entityId: task.id,
            entityName: task.title,
            action: "updated",
            changes,
            metadata: { ...SEED_METADATA, milestoneId: milestone.id },
          });
        }
      }

      taskIdsByTitle.set(demoTask.title, task.id);
      taskCount++;
    }
  }

  return { milestoneCount: DEMO_MILESTONES.length, taskCount };
};

const seedMap = async (
  target: SeedTarget,
  modules: Modules,
  fixtures: DemoFixtures,
) => {
  const { createMapRepository, createMapService } = modules.mapPkg;
  const { createTimelineRecord } = modules.timelinePkg;
  const mapService = createMapService(createMapRepository());
  const layer = (name: string, sourceFilename: string, geoData: unknown) => ({
    name,
    layerName: name,
    sourceFilename,
    fileType: "geojson",
    geoData,
  });

  // Same calls POST /maps/layers/upload makes after the map-server has turned
  // an uploaded file into GeoJSON: one call per "upload".
  const uploads = [
    {
      projectId: target.projectId,
      projectLayer: layer(
        "Project Boundary",
        LAYER_FILES.boundary,
        fixtures.layers.boundary,
      ),
      unitLayer: layer(
        "Treatment Units",
        LAYER_FILES.units,
        fixtures.layers.units,
      ),
      unitIdKey: "UNIT_ID",
    },
    {
      projectId: target.projectId,
      projectLayer: layer(
        "Access Roads",
        LAYER_FILES.roads,
        fixtures.layers.roads,
      ),
      unitLayer: null,
    },
    {
      projectId: target.projectId,
      projectLayer: layer(
        "Survey Points",
        LAYER_FILES.surveyPoints,
        fixtures.layers.surveyPoints,
      ),
      unitLayer: null,
    },
  ];

  let layerCount = 0;
  for (const upload of uploads) {
    const result = await mapService.createLayersFromFiles(upload);
    if (!result.success) {
      throw new Error(`Map layer upload failed: ${result.error}`);
    }
    for (const warning of result.warnings ?? []) {
      console.warn(`  map warning: ${warning}`);
    }
    const created: Array<{ id: string; name: string }> = result.layers ?? [];
    layerCount += created.length;
    await createTimelineRecord({
      projectId: target.projectId,
      userId: target.ownerId,
      entityType: "map_layer",
      entityId: target.projectId,
      action: "created",
      metadata: {
        ...SEED_METADATA,
        layerIds: created.map((l) => l.id),
        layerNames: created.map((l) => l.name),
      },
    });
  }
  return layerCount;
};

const getOrCreateCommenter = async (): Promise<string> => {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, COMMENTER.email));
  if (existing) {
    return existing.id;
  }

  // Unverified user with no org/memberships: it can never log in and exists
  // only to author the demo "public" comment.
  const [created] = await db
    .insert(user)
    .values({ email: COMMENTER.email })
    .returning({ id: user.id });
  const now = new Date();
  await db.insert(profile).values({
    userId: created.id,
    firstName: COMMENTER.firstName,
    lastName: COMMENTER.lastName,
    city: COMMENTER.city,
    state: COMMENTER.state,
    userRole: "citizen",
    createdAt: now,
    updatedAt: now,
  });
  return created.id;
};

const seedComments = async (target: SeedTarget, modules: Modules) => {
  const { createTimelineRecord } = modules.timelinePkg;
  const commenterId = await getOrCreateCommenter();
  const idsByKey = new Map<string, string>();

  for (const demoComment of DEMO_COMMENTS) {
    const userId =
      demoComment.author === "owner" ? target.ownerId : commenterId;
    // createComment enforces the one-level nesting / same-project rules.
    // The auto-responder is NOT triggered (it only runs from the public route).
    const created = await createComment({
      projectId: target.projectId,
      userId,
      content: demoComment.content,
      parentCommentId: demoComment.replyTo
        ? idsByKey.get(demoComment.replyTo)
        : null,
      isPublic: demoComment.isPublic,
    });
    await createTimelineRecord({
      projectId: target.projectId,
      userId,
      entityType: "comment",
      entityId: created.id,
      action: "created",
      metadata: SEED_METADATA,
    });
    idsByKey.set(demoComment.key, created.id);
  }
  return idsByKey.size;
};

const seedTimelineEvents = async (target: SeedTarget, modules: Modules) => {
  const { createTimelineRecord } = modules.timelinePkg;
  // Manual, dated entries — what POST /timeline/:projectId/manual creates.
  for (const event of DEMO_TIMELINE_EVENTS) {
    await createTimelineRecord({
      projectId: target.projectId,
      userId: target.ownerId,
      entityType: "project",
      entityId: target.projectId,
      action: "added",
      title: event.title,
      description: event.description,
      isPublic: true,
      startedAt: toDate(event.startedAt, 9),
      endedAt: event.endedAt ? toDate(event.endedAt, 17) : undefined,
      metadata: SEED_METADATA,
    });
  }
  return DEMO_TIMELINE_EVENTS.length;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = async () => {
  const args = parseArgs();

  const fixtures = await writeDemoFixtures(REPO_ROOT);
  console.log(`Fixtures written to ${path.relative(REPO_ROOT, fixtures.dir)}/`);
  if (args.isFixturesOnly) {
    return;
  }

  if (!args.orgSlug || !args.officeSlug || !args.projectSlug) {
    throw new Error(
      "Usage: seed-demo-project.ts <orgSlug> <officeSlug> <projectSlug> [--clean] [--skip-uploads] [--allow-remote-db=<host>] [--fixtures-only]",
    );
  }

  const host = assertSafeDatabase(args.allowRemoteHost);
  const modules = await loadModules();
  const target = await resolveTarget(
    args.orgSlug,
    args.officeSlug,
    args.projectSlug,
  );
  console.log(
    `Seeding "${target.projectName}" (${target.projectId}) on ${host}, owner ${target.ownerEmail}`,
  );

  const cleanup = await cleanSeededData(target, modules);
  if (args.isClean) {
    if (!args.isSkipUploads) {
      await cleanup.deleteStorageObjects();
    }
    console.log("Clean complete.");
    return;
  }

  const projectChanges = await seedProjectMeta(target, modules);
  console.log(`  project: ${projectChanges} field(s) updated`);
  console.log(`  fields: ${await seedFields(target, modules)}`);
  console.log(`  context: ${await seedContext(target, modules)}`);

  let documentIds = new Map<string, string>();
  if (args.isSkipUploads) {
    console.log("  documents: skipped (--skip-uploads)");
  } else {
    try {
      documentIds = await seedDocuments(target, modules, fixtures);
      console.log(`  documents: ${documentIds.size}`);
    } catch (error) {
      // No record is written for a file whose blob could not be stored: the
      // list would render but preview/download would be broken.
      console.warn(
        `  documents: skipped — R2 upload failed (${error instanceof Error ? error.message : error}). Fix the R2_* credentials in apps/turboplan/.env.local and re-run.`,
      );
    }
  }

  const schedule = await seedSchedule(target, modules, documentIds);
  console.log(
    `  schedule: ${schedule.milestoneCount} milestones, ${schedule.taskCount} tasks`,
  );
  console.log(`  map layers: ${await seedMap(target, modules, fixtures)}`);
  console.log(`  comments: ${await seedComments(target, modules)}`);
  console.log(
    `  timeline events: ${await seedTimelineEvents(target, modules)}`,
  );
  console.log("Done.");
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
