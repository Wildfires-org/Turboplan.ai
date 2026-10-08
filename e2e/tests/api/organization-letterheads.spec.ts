import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

import {
  type ApiTestUser,
  addOrganizationViewer,
  authHeaders,
  createApiTestUser,
  createOwnedWorkspace,
  type OwnedWorkspace,
} from "../../utils";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

const letterheadBody = (name: string) => ({
  name,
  layout: "columns",
  lines: "Partner Agency\nPartner Unit",
  contact: "2 Partner Way",
  color: "#1F5F3A",
});

/**
 * Organization letterhead library API
 * (/api/organizations/:organizationId/letterheads): CRUD for the owner and
 * RBAC for a viewer member and an outsider. Runs in a fresh owner's personal
 * organization so the library starts empty.
 */
test.describe("Organization letterhead library API", () => {
  let workspace: OwnedWorkspace;
  let viewer: ApiTestUser;
  let outsider: ApiTestUser;
  let listUrl: string;

  test.beforeAll(async () => {
    workspace = await createOwnedWorkspace("org-letterheads-api");
    viewer = await createApiTestUser("org-letterheads-api-viewer");
    outsider = await createApiTestUser("org-letterheads-api-outsider");
    await addOrganizationViewer({
      organizationId: workspace.organizationId,
      userId: viewer.id,
    });
    listUrl = `${SERVER_URL}/api/organizations/${workspace.organizationId}/letterheads`;
  });

  test("owner creates, renames and deletes a letterhead", async ({
    request,
  }) => {
    const headers = authHeaders(workspace.owner);

    const created = await request.post(listUrl, {
      headers,
      data: letterheadBody("Partner Agency"),
    });
    expect(created.status()).toBe(200);
    const { letterhead } = await created.json();
    expect(letterhead).toMatchObject({
      organizationId: workspace.organizationId,
      name: "Partner Agency",
      layout: "columns",
      lines: "Partner Agency\nPartner Unit",
      contact: "2 Partner Way",
      logoUrl: null,
      color: "#1f5f3a",
    });

    const listed = await request.get(listUrl, { headers });
    expect(listed.status()).toBe(200);
    expect((await listed.json()).letterheads).toContainEqual(
      expect.objectContaining({ id: letterhead.id, name: "Partner Agency" }),
    );

    const renamed = await request.put(`${listUrl}/${letterhead.id}`, {
      headers,
      data: { ...letterheadBody("Partner Agency (renamed)"), color: "" },
    });
    expect(renamed.status()).toBe(200);
    expect((await renamed.json()).letterhead).toMatchObject({
      id: letterhead.id,
      name: "Partner Agency (renamed)",
      color: null,
    });

    const deleted = await request.delete(`${listUrl}/${letterhead.id}`, {
      headers,
    });
    expect(deleted.status()).toBe(200);

    const afterDelete = await request.get(listUrl, { headers });
    expect(
      (await afterDelete.json()).letterheads.map(
        (row: { id: string }) => row.id,
      ),
    ).not.toContain(letterhead.id);

    const deletedAgain = await request.delete(`${listUrl}/${letterhead.id}`, {
      headers,
    });
    expect(deletedAgain.status()).toBe(404);
  });

  test("rejects invalid bodies and logos outside our storage", async ({
    request,
  }) => {
    const headers = authHeaders(workspace.owner);

    const missingName = await request.post(listUrl, {
      headers,
      data: { ...letterheadBody(""), name: "" },
    });
    expect(missingName.status()).toBe(400);

    const badLayout = await request.post(listUrl, {
      headers,
      data: { ...letterheadBody("Bad layout"), layout: "diagonal" },
    });
    expect(badLayout.status()).toBe(400);

    const badColor = await request.post(listUrl, {
      headers,
      data: { ...letterheadBody("Bad color"), color: "green" },
    });
    expect(badColor.status()).toBe(400);

    const externalLogo = await request.post(listUrl, {
      headers,
      data: {
        ...letterheadBody("External logo"),
        logoUrl: "https://example.com/logo.png",
      },
    });
    expect(externalLogo.status()).toBe(400);

    const unknownLetterhead = await request.put(`${listUrl}/${randomUUID()}`, {
      headers,
      data: letterheadBody("Unknown"),
    });
    expect(unknownLetterhead.status()).toBe(404);
  });

  test("a viewer can list but not change the library", async ({ request }) => {
    const ownerHeaders = authHeaders(workspace.owner);
    const viewerHeaders = authHeaders(viewer);

    const listed = await request.get(listUrl, { headers: viewerHeaders });
    expect(listed.status()).toBe(200);

    const created = await request.post(listUrl, {
      headers: viewerHeaders,
      data: letterheadBody("Viewer attempt"),
    });
    expect(created.status()).toBe(403);

    // An owner's letterhead the viewer then tries to change.
    const ownerCreated = await request.post(listUrl, {
      headers: ownerHeaders,
      data: letterheadBody("Owner letterhead"),
    });
    expect(ownerCreated.status()).toBe(200);
    const { letterhead } = await ownerCreated.json();

    try {
      const updated = await request.put(`${listUrl}/${letterhead.id}`, {
        headers: viewerHeaders,
        data: letterheadBody("Viewer rename"),
      });
      expect(updated.status()).toBe(403);

      const deleted = await request.delete(`${listUrl}/${letterhead.id}`, {
        headers: viewerHeaders,
      });
      expect(deleted.status()).toBe(403);
    } finally {
      await request.delete(`${listUrl}/${letterhead.id}`, {
        headers: ownerHeaders,
      });
    }
  });

  test("a non-member can neither list nor create", async ({ request }) => {
    const headers = authHeaders(outsider);

    const listed = await request.get(listUrl, { headers });
    expect(listed.status()).toBe(403);

    const created = await request.post(listUrl, {
      headers,
      data: letterheadBody("Outsider attempt"),
    });
    expect(created.status()).toBe(403);
  });
});
