import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { createTestDB } from "@wildfires-org/turboplan-db/db-client";
import { createDocumentLetterhead } from "@wildfires-org/turboplan-db/queries";
import { organization } from "@wildfires-org/turboplan-db/schemas";
import { getOfficeById } from "@wildfires-org/turboplan-workspace/server";
import {
  buildLetterheadMarkdown,
  type DocumentLetterhead,
} from "@wildfires-org/turboplan-workspace/types";

import {
  type ApiTestUser,
  addOrganizationViewer,
  authHeaders,
  createApiTestUser,
  createOwnedWorkspace,
  type OwnedWorkspace,
  seedChatDocument,
} from "../../utils";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

const NAME_LINES = ["Department of Testing", "Quality District"];
const CONTACT_LINES = ["1 Test Plaza", "Testville, CA 90000"];

/**
 * Document letterhead + document profile API (apps/server document-export):
 * - GET  /api/documents/letterhead?projectId=[&documentId=]
 * - PUT  /api/documents/:documentId/letterhead
 * - GET  /api/documents/profile?projectId=
 * - POST /api/documents/remember-fact
 *
 * Each describe block works in a fresh owner's personal workspace (no model
 * is ever called). The office letterhead is configured through the real
 * PUT /api/offices/:id endpoint; documents are seeded directly in the DB.
 */
test.describe("Document letterhead API", () => {
  let workspace: OwnedWorkspace;
  let viewer: ApiTestUser;
  let outsider: ApiTestUser;

  test.beforeAll(async ({ request }) => {
    workspace = await createOwnedWorkspace("letterhead-api");
    viewer = await createApiTestUser("letterhead-api-viewer");
    outsider = await createApiTestUser("letterhead-api-outsider");
    await addOrganizationViewer({
      organizationId: workspace.organizationId,
      userId: viewer.id,
    });

    const response = await request.put(
      `${SERVER_URL}/api/offices/${workspace.officeId}`,
      {
        headers: authHeaders(workspace.owner),
        data: {
          documentLetterheadLayout: "centered",
          documentLetterheadLines: NAME_LINES.join("\n"),
          documentLetterheadContact: CONTACT_LINES.join("\n"),
          documentLetterheadColor: "#1E3A8A",
        },
      },
    );
    expect(response.status()).toBe(200);
  });

  const letterheadUrl = (projectId: string, documentId?: string) =>
    `${SERVER_URL}/api/documents/letterhead?projectId=${projectId}${
      documentId ? `&documentId=${documentId}` : ""
    }`;

  test("GET /letterhead returns the office letterhead and its markdown", async ({
    request,
  }) => {
    const response = await request.get(letterheadUrl(workspace.projectId), {
      headers: authHeaders(workspace.owner),
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    const expectedLetterhead: DocumentLetterhead = {
      layout: "centered",
      nameLines: NAME_LINES,
      contactLines: CONTACT_LINES,
      // Stored normalized to lowercase.
      color: "#1e3a8a",
    };
    expect(body.letterhead).toEqual(expectedLetterhead);
    expect(body.defaultLetterhead).toEqual(expectedLetterhead);
    expect(body.selection).toBe("default");
    expect(Array.isArray(body.options)).toBe(true);
    expect(body.markdown).toBe(buildLetterheadMarkdown(expectedLetterhead));
    // Centered layout: bold name rows, a centered separator, contacts joined.
    expect(body.markdown).toContain(`| **${NAME_LINES[0]}** |`);
    expect(body.markdown).toContain("| :---: |");
    expect(body.markdown).toContain(CONTACT_LINES.join(" · "));
  });

  test("GET /letterhead is readable by a viewer but not by an outsider", async ({
    request,
  }) => {
    const asViewer = await request.get(letterheadUrl(workspace.projectId), {
      headers: authHeaders(viewer),
    });
    expect(asViewer.status()).toBe(200);

    const asOutsider = await request.get(letterheadUrl(workspace.projectId), {
      headers: authHeaders(outsider),
    });
    expect(asOutsider.status()).toBe(403);
  });

  test("GET /letterhead validates its query", async ({ request }) => {
    const headers = authHeaders(workspace.owner);

    const missingProject = await request.get(
      `${SERVER_URL}/api/documents/letterhead`,
      { headers },
    );
    expect(missingProject.status()).toBe(400);

    const badDocumentId = await request.get(
      letterheadUrl(workspace.projectId, "not-a-uuid"),
      { headers },
    );
    expect(badDocumentId.status()).toBe(400);
  });

  test("PUT /:documentId/letterhead switches a document between none, a library letterhead and the default", async ({
    request,
  }) => {
    const headers = authHeaders(workspace.owner);
    const { documentId } = await seedChatDocument({
      userId: workspace.owner.id,
      projectId: workspace.projectId,
      title: "Selection doc",
      content: "# Selection doc\n\nBody.",
    });
    const library = await createDocumentLetterhead({
      organizationId: workspace.organizationId,
      createdBy: workspace.owner.id,
      name: "Partner Agency",
      layout: "split",
      lines: "Partner Agency\nPartner Unit",
      contact: "",
      logoUrl: null,
      color: null,
    });
    const select = (selection: string) =>
      request.put(`${SERVER_URL}/api/documents/${documentId}/letterhead`, {
        headers,
        data: { projectId: workspace.projectId, selection },
      });
    const readDocumentLetterhead = async () => {
      const response = await request.get(
        letterheadUrl(workspace.projectId, documentId),
        { headers },
      );
      expect(response.status()).toBe(200);
      return response.json();
    };

    // None: no letterhead, no markdown.
    expect((await select("none")).status()).toBe(200);
    let body = await readDocumentLetterhead();
    expect(body.selection).toBe("none");
    expect(body.letterhead).toBeNull();
    expect(body.markdown).toBeNull();

    // A library letterhead of the project's organization.
    expect((await select(library.id)).status()).toBe(200);
    body = await readDocumentLetterhead();
    expect(body.selection).toBe(library.id);
    expect(body.letterhead).toMatchObject({
      layout: "split",
      nameLines: ["Partner Agency", "Partner Unit"],
    });
    expect(body.options).toContainEqual({
      id: library.id,
      name: "Partner Agency",
    });

    // Back to the office default.
    expect((await select("default")).status()).toBe(200);
    body = await readDocumentLetterhead();
    expect(body.selection).toBe("default");
    expect(body.letterhead).toMatchObject({ nameLines: NAME_LINES });
  });

  test("PUT /:documentId/letterhead answers 404 for documents and letterheads outside the project", async ({
    request,
  }) => {
    const headers = authHeaders(workspace.owner);
    const { documentId } = await seedChatDocument({
      userId: workspace.owner.id,
      projectId: workspace.projectId,
      title: "Scoped doc",
      content: "# Scoped doc",
    });

    // Unknown document.
    const unknownDocument = await request.put(
      `${SERVER_URL}/api/documents/${randomUUID()}/letterhead`,
      { headers, data: { projectId: workspace.projectId, selection: "none" } },
    );
    expect(unknownDocument.status()).toBe(404);

    // A document of another project (the outsider's own workspace).
    const other = await createOwnedWorkspace("lh-api-other");
    const { documentId: otherDocumentId } = await seedChatDocument({
      userId: other.owner.id,
      projectId: other.projectId,
      title: "Other doc",
      content: "# Other doc",
    });
    const foreignDocument = await request.put(
      `${SERVER_URL}/api/documents/${otherDocumentId}/letterhead`,
      { headers, data: { projectId: workspace.projectId, selection: "none" } },
    );
    expect(foreignDocument.status()).toBe(404);

    // A library letterhead of another organization.
    const foreignLetterhead = await createDocumentLetterhead({
      organizationId: other.organizationId,
      createdBy: other.owner.id,
      name: "Foreign",
      layout: "split",
      lines: "Foreign Agency",
      contact: "",
      logoUrl: null,
      color: null,
    });
    const foreignSelection = await request.put(
      `${SERVER_URL}/api/documents/${documentId}/letterhead`,
      {
        headers,
        data: {
          projectId: workspace.projectId,
          selection: foreignLetterhead.id,
        },
      },
    );
    expect(foreignSelection.status()).toBe(404);
  });

  test("PUT /:documentId/letterhead validates input and requires UPDATE", async ({
    request,
  }) => {
    const { documentId } = await seedChatDocument({
      userId: workspace.owner.id,
      projectId: workspace.projectId,
      title: "Guarded doc",
      content: "# Guarded doc",
    });
    const url = `${SERVER_URL}/api/documents/${documentId}/letterhead`;
    const data = { projectId: workspace.projectId, selection: "none" };

    const badSelection = await request.put(url, {
      headers: authHeaders(workspace.owner),
      data: { projectId: workspace.projectId, selection: "something" },
    });
    expect(badSelection.status()).toBe(400);

    const badDocumentId = await request.put(
      `${SERVER_URL}/api/documents/not-a-uuid/letterhead`,
      { headers: authHeaders(workspace.owner), data },
    );
    expect(badDocumentId.status()).toBe(400);

    const asViewer = await request.put(url, {
      headers: authHeaders(viewer),
      data,
    });
    expect(asViewer.status()).toBe(403);

    const asOutsider = await request.put(url, {
      headers: authHeaders(outsider),
      data,
    });
    expect(asOutsider.status()).toBe(403);
  });
});

test.describe("Document profile API", () => {
  let workspace: OwnedWorkspace;
  let outsider: ApiTestUser;

  test.beforeAll(async ({ request }) => {
    workspace = await createOwnedWorkspace("profile-api");
    outsider = await createApiTestUser("profile-api-outsider");

    // Organization-level details (no API shortcut: the org PUT needs the
    // whole General form), then office-level ones through the office PUT.
    const { db, close } = createTestDB();
    try {
      await db
        .update(organization)
        .set({
          documentProfile: {
            signatoryName: "Org Signatory",
            signatoryTitle: "Forest Supervisor",
            facts: "Shared fact\nOrg fact",
          },
        })
        .where(eq(organization.id, workspace.organizationId));
    } finally {
      await close();
    }

    const response = await request.put(
      `${SERVER_URL}/api/offices/${workspace.officeId}`,
      {
        headers: authHeaders(workspace.owner),
        data: {
          documentProfile: {
            signatoryName: "Office Signatory",
            contactEmail: "comments@example.test",
            facts: "Office fact\nShared fact",
          },
        },
      },
    );
    expect(response.status()).toBe(200);
  });

  test("GET /profile merges office details over the organization's", async ({
    request,
  }) => {
    const response = await request.get(
      `${SERVER_URL}/api/documents/profile?projectId=${workspace.projectId}`,
      { headers: authHeaders(workspace.owner) },
    );
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.profile).toEqual({
      signatoryName: "Office Signatory",
      signatoryTitle: "Forest Supervisor",
      contactEmail: "comments@example.test",
      // Office lines first, then the organization's, de-duplicated.
      facts: "Office fact\nShared fact\nOrg fact",
    });
    expect(body.facts).toEqual([
      "Signatory: Office Signatory, Forest Supervisor",
      "Contact email: comments@example.test",
      "Office fact",
      "Shared fact",
      "Org fact",
    ]);
  });

  test("GET /profile validates the project and requires READ", async ({
    request,
  }) => {
    const missing = await request.get(`${SERVER_URL}/api/documents/profile`, {
      headers: authHeaders(workspace.owner),
    });
    expect(missing.status()).toBe(400);

    const asOutsider = await request.get(
      `${SERVER_URL}/api/documents/profile?projectId=${workspace.projectId}`,
      { headers: authHeaders(outsider) },
    );
    expect(asOutsider.status()).toBe(403);
  });
});

// Own workspace: remembering facts changes the office details that the
// profile tests above assert exactly.
test.describe("Remember document fact API", () => {
  let workspace: OwnedWorkspace;
  let outsider: ApiTestUser;

  test.beforeAll(async () => {
    workspace = await createOwnedWorkspace("remember-fact-api");
    outsider = await createApiTestUser("remember-fact-api-outsider");
  });

  test("POST /remember-fact appends to the office details once", async ({
    request,
  }) => {
    const headers = authHeaders(workspace.owner);
    const data = {
      projectId: workspace.projectId,
      label: "Comment deadline",
      value: "March 3, 2027",
    };

    const first = await request.post(
      `${SERVER_URL}/api/documents/remember-fact`,
      { headers, data },
    );
    expect(first.status()).toBe(200);
    expect((await first.json()).documentProfile.facts).toContain(
      "Comment deadline: March 3, 2027",
    );

    // Remembering the same fact again does not duplicate the line.
    const second = await request.post(
      `${SERVER_URL}/api/documents/remember-fact`,
      { headers, data },
    );
    expect(second.status()).toBe(200);

    const office = await getOfficeById(workspace.officeId);
    const lines = (office?.documentProfile?.facts ?? "").split("\n");
    expect(
      lines.filter((line) => line === "Comment deadline: March 3, 2027"),
    ).toHaveLength(1);
  });

  test("POST /remember-fact validates the body and requires office UPDATE", async ({
    request,
  }) => {
    const url = `${SERVER_URL}/api/documents/remember-fact`;

    const invalid = await request.post(url, {
      headers: authHeaders(workspace.owner),
      data: { projectId: workspace.projectId, label: "", value: "x" },
    });
    expect(invalid.status()).toBe(400);

    const asOutsider = await request.post(url, {
      headers: authHeaders(outsider),
      data: { projectId: workspace.projectId, label: "Fact", value: "x" },
    });
    expect(asOutsider.status()).toBe(403);

    // An unknown project answers like a denial.
    const unknownProject = await request.post(url, {
      headers: authHeaders(workspace.owner),
      data: { projectId: randomUUID(), label: "Fact", value: "x" },
    });
    expect(unknownProject.status()).toBe(403);
  });
});
