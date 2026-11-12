/**
 * The workspace services on D1: the generated SQLite migrations applied to a
 * local SQLite file (node:sqlite, the same engine D1 runs), then real query
 * and service functions run against it through the D1 driver.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

const directory = mkdtempSync(join(tmpdir(), "turboplan-d1-"));
process.env.DB_PROVIDER = "d1";
process.env.D1_LOCAL_PATH = join(directory, "turboplan.sqlite");

const { runD1Migrations } = await import("@wildfires-org/turboplan-db/migrate");
const { closeDB, db, isUniqueViolation } = await import(
  "@wildfires-org/turboplan-db/db-client"
);
const schema = await import("@wildfires-org/turboplan-db/schemas");
const queries = await import("@wildfires-org/turboplan-db/queries");
const { eq } = await import("drizzle-orm");
const { createOrganization, getOrganizationBySlug, updateOrganization } =
  await import("../src/server/organizations/queries");
const { createOffice } = await import("../src/server/offices/queries");
const { createProject, getProjectWithRelations, getProjectBySlug } =
  await import("../src/server/projects/queries");
const { searchUsers } = await import("../src/server/users/queries");

describe("workspace on D1 (node:sqlite)", () => {
  let userId = "";

  before(async () => {
    await runD1Migrations();
  });

  after(async () => {
    await closeDB();
    rmSync(directory, { recursive: true, force: true });
  });

  it("creates a user, personal workspace and profile in one transaction", async () => {
    const [created] = await queries.createUserWithProfile(
      " Ada.Lovelace@Example.com ",
    );
    assert.ok(created);
    userId = created.id;
    // Column defaults (uuid, now(), literals) are filled in on insert.
    assert.match(created.id, /^[0-9a-f-]{36}$/);
    assert.equal(created.email, "ada.lovelace@example.com");
    assert.equal(created.emailVerified, null);

    const [profile] = await db
      .select()
      .from(schema.profile)
      .where(eq(schema.profile.userId, userId));
    assert.ok(profile);
    await db
      .update(schema.profile)
      .set({ firstName: "Ada", lastName: "Lovelace" })
      .where(eq(schema.profile.userId, userId));

    const personal = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.createdBy, userId));
    assert.equal(personal.length, 1);
    assert.deepEqual(personal[0]?.slugHistory, []);
    assert.ok(personal[0]?.createdAt instanceof Date);
  });

  it("creates an organization, an office and a project", async () => {
    const org = await createOrganization({
      name: "Pacific Fire District",
      createdBy: userId,
      emailDomains: ["pfd.example"],
    });
    assert.equal(org.slug, "pacific-fire-district");
    assert.deepEqual(org.emailDomains, ["pfd.example"]);

    const office = await createOffice({
      name: "Planning",
      organizationId: org.id,
      createdBy: userId,
    });
    const project = await createProject({
      name: "Ridge Fuel Break",
      slug: "ridge-fuel-break",
      officeId: office.id,
      createdBy: userId,
    });
    assert.equal(project.isTemplate, false);
    assert.ok(project.startDate instanceof Date);
    assert.ok(project.endDate instanceof Date);
    assert.ok(project.endDate.getTime() > project.startDate.getTime());

    const withRelations = await getProjectWithRelations(project.id);
    assert.equal(withRelations?.office?.name, "Planning");
    assert.equal(withRelations?.creator?.email, "ada.lovelace@example.com");

    const bySlug = await getProjectBySlug(
      org.slug,
      office.slug,
      "ridge-fuel-break",
    );
    assert.equal(bySlug.entity?.id, project.id);
  });

  it("finds an organization by a slug it used to have", async () => {
    const org = await createOrganization({
      name: "Old Name Rangers",
      createdBy: userId,
    });
    await updateOrganization({ id: org.id, slug: "new-name-rangers" });

    const current = await getOrganizationBySlug("new-name-rangers");
    assert.equal(current.entity?.id, org.id);
    assert.equal(current.foundViaHistory, false);

    const old = await getOrganizationBySlug("old-name-rangers");
    assert.equal(old.entity?.id, org.id);
    assert.equal(old.foundViaHistory, true);
    assert.deepEqual(old.entity?.slugHistory, ["old-name-rangers"]);

    assert.equal((await getOrganizationBySlug("never-used")).entity, null);
    // A slug in another organization's history cannot be taken.
    const other = await createOrganization({
      name: "Other",
      createdBy: userId,
    });
    await assert.rejects(
      updateOrganization({ id: other.id, slug: "old-name-rangers" }),
      /already taken/,
    );
  });

  it("persists chat messages and upserts the streaming reply", async () => {
    const chatId = randomUUID();
    await queries.saveChat({ id: chatId, userId, title: "Fuel break plan" });
    // What the chat route treats as "already processing".
    await assert.rejects(
      queries.saveChat({ id: chatId, userId, title: "Fuel break plan" }),
      (error) => isUniqueViolation(error),
    );
    const userMessage = {
      id: randomUUID(),
      chatId,
      role: "user",
      parts: [{ type: "text", text: "Draft a timeline" }],
      attachments: [],
      createdAt: new Date(Date.now() - 1000),
    };
    await queries.saveMessages({ messages: [userMessage] });

    const reply = {
      id: randomUUID(),
      chatId,
      role: "assistant",
      parts: [{ type: "text", text: "Here" }],
      attachments: [],
      createdAt: new Date(),
    };
    await queries.upsertAssistantMessage({ message: reply });
    await queries.upsertAssistantMessage({
      message: { ...reply, parts: [{ type: "text", text: "Here is a plan" }] },
    });
    // The guarded upsert never overwrites a user message.
    await queries.upsertAssistantMessage({
      message: { ...userMessage, role: "assistant", parts: [] },
    });

    const messages = await queries.getMessagesByChatId({ id: chatId });
    assert.deepEqual(
      messages.map((m) => [m.role, m.parts]),
      [
        ["user", [{ type: "text", text: "Draft a timeline" }]],
        ["assistant", [{ type: "text", text: "Here is a plan" }]],
      ],
    );
  });

  it("loads nested relations with the relational query API", async () => {
    const [project] = await db.select().from(schema.project).limit(1);
    assert.ok(project);
    const documentId = randomUUID();
    const [milestone] = await db
      .insert(schema.milestones)
      .values({
        title: "Survey",
        documentId,
        projectId: project.id,
        userId,
        startDate: new Date("2026-01-05T00:00:00Z"),
        dueDate: new Date("2026-02-05T00:00:00Z"),
      })
      .returning();
    assert.ok(milestone);
    await db.insert(schema.tasks).values(
      ["Walk the ridge", "Map access roads"].map((title, order) => ({
        title,
        order,
        documentId,
        milestoneId: milestone.id,
        userId,
        assigneeIds: [userId],
        startDate: new Date("2026-01-05T00:00:00Z"),
        dueDate: new Date("2026-01-20T00:00:00Z"),
      })),
    );

    const loaded = await db.query.milestones.findFirst({
      where: (m, { eq: equals }) => equals(m.id, milestone.id),
      columns: { id: true, title: true, dueDate: true, status: true },
      with: {
        tasks: {
          columns: { title: true, assigneeIds: true, startDate: true },
          orderBy: (t, { desc }) => [desc(t.order)],
          with: { user: { columns: { email: true } } },
        },
        project: { columns: { name: true, isPublic: true } },
      },
    });
    assert.deepEqual(loaded, {
      id: milestone.id,
      title: "Survey",
      dueDate: new Date("2026-02-05T00:00:00Z"),
      status: "draft",
      tasks: [
        {
          title: "Map access roads",
          assigneeIds: [userId],
          startDate: new Date("2026-01-05T00:00:00Z"),
          user: { email: "ada.lovelace@example.com" },
        },
        {
          title: "Walk the ridge",
          assigneeIds: [userId],
          startDate: new Date("2026-01-05T00:00:00Z"),
          user: { email: "ada.lovelace@example.com" },
        },
      ],
      project: { name: project.name, isPublic: false },
    });
  });

  it("upserts with returning", async () => {
    const [org] = await db.select().from(schema.organization).limit(1);
    assert.ok(org);
    const first = await queries.upsertOrganizationPrompt({
      organizationId: org.id,
      prompt: "Use metric units.",
      userId,
    });
    const second = await queries.upsertOrganizationPrompt({
      organizationId: org.id,
      prompt: "Use metric units and cite sources.",
      userId,
    });
    assert.equal(second.prompt, "Use metric units and cite sources.");
    // The conflict updated the row instead of adding one.
    assert.equal(second.createdAt.getTime(), first.createdAt.getTime());
    const rows = await db
      .select()
      .from(schema.organizationContext)
      .where(eq(schema.organizationContext.organizationId, org.id));
    assert.equal(rows.length, 1);
  });

  it("loads an organization's context for the chat system prompt", async () => {
    const [org] = await db.select().from(schema.organization).limit(1);
    assert.ok(org);
    await queries.createOrganizationDocument({
      organizationId: org.id,
      filename: "plan.pdf",
      originalFilename: "Plan.pdf",
      mimeType: "application/pdf",
      size: 1024,
      url: "https://assets.example.test/plan.pdf",
      uploadedBy: userId,
      extractedText: "x".repeat(1000),
      isPinned: true,
    });
    await queries.createOrganizationMemory({
      organizationId: org.id,
      content: "Prefers metric units.",
      createdBy: userId,
    });

    const sources = await queries.getOrganizationContextSources(org.id);
    assert.equal(sources?.prompt, "Use metric units and cite sources.");
    assert.deepEqual(
      sources?.documents.map((d) => [
        d.originalFilename,
        d.isPinned,
        d.excerpt?.length,
      ]),
      [["Plan.pdf", true, queries.ORGANIZATION_DOCUMENT_EXCERPT_CHARS]],
    );
    assert.deepEqual(
      sources?.memories.map((m) => m.content),
      ["Prefers metric units."],
    );
  });

  it("runs transactions (not atomic on D1: no rollback)", async () => {
    const email = "rollback@example.com";
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.insert(schema.user).values({ email });
        throw new Error("boom");
      }),
      /boom/,
    );
    // Documented limitation: the write before the failure stays.
    const [kept] = await queries.getUser(email);
    assert.equal(kept?.email, email);
  });

  it("searches users by email and name", async () => {
    await queries.createUserWithProfile("grace@example.com");
    const results = await searchUsers("lovel", 10, { global: true });
    assert.deepEqual(
      results.map((r) => r.email),
      ["ada.lovelace@example.com"],
    );
    assert.ok((results[0]?.similarity ?? 0) > 0);

    const byFullName = await searchUsers("ada lovelace", 10, { global: true });
    assert.equal(byFullName[0]?.email, "ada.lovelace@example.com");

    // LIKE wildcards in the query are matched literally.
    assert.deepEqual(await searchUsers("%%%", 10, { global: true }), []);
  });
});
