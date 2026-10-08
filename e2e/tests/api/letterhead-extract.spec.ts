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
const EXTRACT_URL = `${SERVER_URL}/api/documents/letterhead/extract`;

// "hello" — valid base64, but not PNG bytes.
const NOT_A_PNG_BASE64 = Buffer.from("hello").toString("base64");

/**
 * POST /api/documents/letterhead/extract — validation and RBAC only.
 *
 * Every request here is rejected BEFORE the vision model is called (bad body,
 * permission denied, or an image that fails decoding). Never send a real
 * PNG/JPEG from this spec: a decodable image goes on to a paid model call.
 *
 * The route rate-limits at 10 requests per user per minute, so each user here
 * stays well below that.
 */
test.describe("Letterhead import (extract) API", () => {
  let workspace: OwnedWorkspace;
  let viewer: ApiTestUser;
  let outsider: ApiTestUser;

  test.beforeAll(async () => {
    workspace = await createOwnedWorkspace("lh-extract-api");
    viewer = await createApiTestUser("letterhead-extract-api-viewer");
    outsider = await createApiTestUser("letterhead-extract-api-outsider");
    await addOrganizationViewer({
      organizationId: workspace.organizationId,
      userId: viewer.id,
    });
  });

  test("rejects a missing or malformed body with 400", async ({ request }) => {
    const headers = authHeaders(workspace.owner);

    const noBody = await request.post(EXTRACT_URL, { headers });
    expect(noBody.status()).toBe(400);

    const missingImage = await request.post(EXTRACT_URL, {
      headers,
      data: {
        organizationId: workspace.organizationId,
        mimeType: "image/png",
      },
    });
    expect(missingImage.status()).toBe(400);

    const unsupportedType = await request.post(EXTRACT_URL, {
      headers,
      data: {
        organizationId: workspace.organizationId,
        image: NOT_A_PNG_BASE64,
        mimeType: "image/gif",
      },
    });
    expect(unsupportedType.status()).toBe(400);
  });

  test("rejects an image that does not decode with 400", async ({
    request,
  }) => {
    const headers = authHeaders(workspace.owner);

    const badBase64 = await request.post(EXTRACT_URL, {
      headers,
      data: {
        organizationId: workspace.organizationId,
        officeId: workspace.officeId,
        image: "not base64 at all!",
        mimeType: "image/png",
      },
    });
    expect(badBase64.status()).toBe(400);
    expect((await badBase64.json()).error).toBe("Invalid image encoding");

    const wrongMagic = await request.post(EXTRACT_URL, {
      headers,
      data: {
        organizationId: workspace.organizationId,
        image: NOT_A_PNG_BASE64,
        mimeType: "image/png",
      },
    });
    expect(wrongMagic.status()).toBe(400);
    expect((await wrongMagic.json()).error).toBe(
      "Image does not match mimeType",
    );
  });

  test("requires UPDATE on the organization or office", async ({ request }) => {
    // Permission is checked before the image is decoded, so an undecodable
    // image proves the 403 comes from RBAC.
    const body = {
      organizationId: workspace.organizationId,
      image: "not base64 at all!",
      mimeType: "image/png",
    };

    const viewerOnOrg = await request.post(EXTRACT_URL, {
      headers: authHeaders(viewer),
      data: body,
    });
    expect(viewerOnOrg.status()).toBe(403);

    const viewerOnOffice = await request.post(EXTRACT_URL, {
      headers: authHeaders(viewer),
      data: { ...body, officeId: workspace.officeId },
    });
    expect(viewerOnOffice.status()).toBe(403);

    const outsiderOnOrg = await request.post(EXTRACT_URL, {
      headers: authHeaders(outsider),
      data: body,
    });
    expect(outsiderOnOrg.status()).toBe(403);

    // An office that is not in the named organization answers like a denial,
    // even for the organization's owner.
    const unknownOffice = await request.post(EXTRACT_URL, {
      headers: authHeaders(workspace.owner),
      data: { ...body, officeId: randomUUID() },
    });
    expect(unknownOffice.status()).toBe(403);
  });
});
