import assert from "node:assert";
import { before, describe, it } from "node:test";

import { resetEnvCache } from "@wildfires-org/turboplan-env";

import {
  deleteOwnedStorageFile,
  isAllowedStorageUrlUpdate,
  isStorageUrlOwnedBy,
  orgLogoStorageKey,
  replacedStorageUrls,
} from "../src/server/r2-client";

const PUBLIC_URL = "https://files.example.test";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const VICTIM_ID = "22222222-2222-2222-2222-222222222222";
const PROJECT_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_PROJECT_ID = "44444444-4444-4444-4444-444444444444";
const ORG_ID = "55555555-5555-5555-5555-555555555555";

const url = (key: string) => `${PUBLIC_URL}/${key}`;

before(() => {
  process.env.R2_ACCESS_KEY_ID = "test-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_ACCOUNT_ID = "test-account";
  process.env.R2_PUBLIC_URL = PUBLIC_URL;
  resetEnvCache();
});

describe("isStorageUrlOwnedBy", () => {
  it("grants a user only their own uploads prefix", () => {
    const owner = { userId: USER_ID };
    assert.strictEqual(
      isStorageUrlOwnedBy(url(`uploads/${USER_ID}/a.png`), owner),
      true,
    );
    assert.strictEqual(
      isStorageUrlOwnedBy(url(`uploads/${VICTIM_ID}/a.png`), owner),
      false,
    );
  });

  it("grants a project its own mcp/signed/cataloger prefixes", () => {
    const owner = { projectId: PROJECT_ID };
    for (const prefix of ["mcp", "signed", "cataloger"]) {
      assert.strictEqual(
        isStorageUrlOwnedBy(url(`${prefix}/${PROJECT_ID}/d.pdf`), owner),
        true,
        prefix,
      );
      // A copied document keeps the source project's key.
      assert.strictEqual(
        isStorageUrlOwnedBy(url(`${prefix}/${OTHER_PROJECT_ID}/d.pdf`), owner),
        false,
        prefix,
      );
    }
  });

  it("does not let a project id stand in for a user id or vice versa", () => {
    assert.strictEqual(
      isStorageUrlOwnedBy(url(`uploads/${PROJECT_ID}/a.png`), {
        projectId: PROJECT_ID,
      }),
      false,
    );
    assert.strictEqual(
      isStorageUrlOwnedBy(url(`mcp/${USER_ID}/a.pdf`), { userId: USER_ID }),
      false,
    );
  });

  it("grants an organization only its own org-logos object", () => {
    const owner = { organizationId: ORG_ID };
    assert.strictEqual(
      isStorageUrlOwnedBy(url(orgLogoStorageKey(ORG_ID, "png")), owner),
      true,
    );
    for (const key of [
      "org-logos/blm.svg",
      `org-logos/${VICTIM_ID}.png`,
      `org-logos/${ORG_ID}.`,
      `org-logos/${ORG_ID}.png/extra`,
      `org-logos/${ORG_ID}.p-ng`,
    ]) {
      assert.strictEqual(isStorageUrlOwnedBy(url(key), owner), false, key);
    }
  });

  it("rejects traversal and foreign hosts", () => {
    const owner = { userId: USER_ID, projectId: PROJECT_ID };
    for (const candidate of [
      url(`uploads/${USER_ID}/../${VICTIM_ID}/f.pdf`),
      url(`mcp/${PROJECT_ID}/%2e%2e/${OTHER_PROJECT_ID}/f.pdf`),
      `https://evil.test/uploads/${USER_ID}/f.pdf`,
      `${PUBLIC_URL}.evil.test/uploads/${USER_ID}/f.pdf`,
    ]) {
      assert.strictEqual(isStorageUrlOwnedBy(candidate, owner), false);
    }
  });

  it("rejects empty or separator-bearing ids and bare prefixes", () => {
    assert.strictEqual(
      isStorageUrlOwnedBy(url("uploads/x/a.png"), { userId: "" }),
      false,
    );
    assert.strictEqual(
      isStorageUrlOwnedBy(url("mcp/a/b/c.pdf"), { projectId: "a/b" }),
      false,
    );
    assert.strictEqual(
      isStorageUrlOwnedBy(url(`mcp/${PROJECT_ID}/`), { projectId: PROJECT_ID }),
      false,
    );
    assert.strictEqual(isStorageUrlOwnedBy(url("uploads/x/a.png"), {}), false);
  });
});

describe("isAllowedStorageUrlUpdate", () => {
  const owner = { userId: USER_ID, organizationId: ORG_ID };

  it("allows omitted, cleared and unchanged values", () => {
    const foreign = url(`uploads/${VICTIM_ID}/doc.pdf`);
    assert.strictEqual(
      isAllowedStorageUrlUpdate(undefined, foreign, owner),
      true,
    );
    assert.strictEqual(isAllowedStorageUrlUpdate(null, foreign, owner), true);
    assert.strictEqual(isAllowedStorageUrlUpdate("", foreign, owner), true);
    assert.strictEqual(
      isAllowedStorageUrlUpdate(foreign, foreign, owner),
      true,
    );
  });

  it("allows external links", () => {
    assert.strictEqual(
      isAllowedStorageUrlUpdate("https://cdn.other.test/logo.png", null, owner),
      true,
    );
  });

  it("allows the caller's own uploads and the org's own logo", () => {
    assert.strictEqual(
      isAllowedStorageUrlUpdate(url(`uploads/${USER_ID}/l.png`), null, owner),
      true,
    );
    assert.strictEqual(
      isAllowedStorageUrlUpdate(
        url(orgLogoStorageKey(ORG_ID, "svg")),
        null,
        owner,
      ),
      true,
    );
  });

  it("rejects another tenant's object in our bucket", () => {
    for (const key of [
      `uploads/${VICTIM_ID}/doc.pdf`,
      `mcp/${PROJECT_ID}/doc.pdf`,
      `org-logos/${VICTIM_ID}.png`,
      "generated-images/project-x-1.png",
    ]) {
      assert.strictEqual(
        isAllowedStorageUrlUpdate(url(key), null, owner),
        false,
        key,
      );
    }
  });

  it("rejects a malformed URL on our storage host", () => {
    assert.strictEqual(
      isAllowedStorageUrlUpdate(
        url(`uploads/${USER_ID}/%2e%2e/${VICTIM_ID}/doc.pdf`),
        null,
        owner,
      ),
      false,
    );
  });
});

describe("replacedStorageUrls", () => {
  const a = url(`uploads/${USER_ID}/a.png`);
  const b = url(`uploads/${USER_ID}/b.png`);

  it("never treats an omitted field as replaced", () => {
    assert.deepStrictEqual(replacedStorageUrls([[undefined, a]]), []);
  });

  it("returns the old URL on an explicit change or clear", () => {
    assert.deepStrictEqual(replacedStorageUrls([[b, a]]), [a]);
    assert.deepStrictEqual(replacedStorageUrls([["", a]]), [a]);
    assert.deepStrictEqual(replacedStorageUrls([[null, a]]), [a]);
  });

  it("ignores unchanged and previously empty fields", () => {
    assert.deepStrictEqual(
      replacedStorageUrls([
        [a, a],
        [b, null],
        [b, ""],
      ]),
      [],
    );
  });

  it("keeps an old URL that another field still holds", () => {
    // Logo moved into the document-logo slot in the same update.
    assert.deepStrictEqual(
      replacedStorageUrls([
        [b, a],
        [a, null],
      ]),
      [],
    );
    // Logo cleared while an omitted field still holds the same URL.
    assert.deepStrictEqual(
      replacedStorageUrls([
        ["", a],
        [undefined, a],
      ]),
      [],
    );
  });
});

describe("deleteOwnedStorageFile", () => {
  it("skips an object the context does not own without consulting references", async () => {
    let referenceChecks = 0;
    const deleted = await deleteOwnedStorageFile(
      url(`uploads/${VICTIM_ID}/doc.pdf`),
      { userId: USER_ID, projectId: PROJECT_ID },
      async () => {
        referenceChecks += 1;
        return false;
      },
    );
    assert.strictEqual(deleted, false);
    assert.strictEqual(referenceChecks, 0);
  });

  it("skips an owned object that is still referenced elsewhere", async () => {
    let referenceChecks = 0;
    const deleted = await deleteOwnedStorageFile(
      url(`uploads/${USER_ID}/doc.pdf`),
      { userId: USER_ID },
      async () => {
        referenceChecks += 1;
        return true;
      },
    );
    assert.strictEqual(deleted, false);
    assert.strictEqual(referenceChecks, 1);
  });

  it("skips when the reference check fails", async () => {
    const deleted = await deleteOwnedStorageFile(
      url(`uploads/${USER_ID}/doc.pdf`),
      { userId: USER_ID },
      async () => {
        throw new Error("db down");
      },
    );
    assert.strictEqual(deleted, false);
  });

  it("is a no-op for empty and external URLs", async () => {
    assert.strictEqual(
      await deleteOwnedStorageFile(null, { userId: USER_ID }),
      false,
    );
    assert.strictEqual(
      await deleteOwnedStorageFile("https://cdn.other.test/x.png", {
        userId: USER_ID,
      }),
      false,
    );
  });
});
