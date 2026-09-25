import assert from "node:assert";
import { before, describe, it } from "node:test";

import { resetEnvCache } from "@wildfires-org/turboplan-env";

import {
  canonicalStorageKey,
  isOwnedUploadUrl,
  isStorageUrl,
} from "../src/server/r2-client";
import { uniqueStorageName } from "../src/server/storage-key";
import {
  assertAllowedContentType,
  UploadService,
} from "../src/server/UploadService";
import {
  isAllowedUploadContentType,
  UploadError,
  UploadErrorCode,
} from "../src/types";

const PUBLIC_URL = "https://files.example.test";
const USER_ID = "11111111-1111-1111-1111-111111111111";

before(() => {
  process.env.R2_ACCESS_KEY_ID = "test-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_ACCOUNT_ID = "test-account";
  process.env.R2_PUBLIC_URL = PUBLIC_URL;
  resetEnvCache();
});

describe("canonicalStorageKey", () => {
  it("returns the key for a plain URL in our bucket", () => {
    assert.strictEqual(
      canonicalStorageKey(`${PUBLIC_URL}/uploads/x/y.png`),
      "uploads/x/y.png",
    );
  });

  it("drops the query string", () => {
    assert.strictEqual(
      canonicalStorageKey(`${PUBLIC_URL}/uploads/x/y.png?v=2`),
      "uploads/x/y.png",
    );
  });

  // The WHATWG parser removes dot-segments — encoded ones included — which is
  // exactly the resolution the eventual HTTP request performs. Ownership is
  // then decided on the *resolved* key, so traversal cannot smuggle a prefix.
  it("normalizes dot-segments the way an HTTP client does", () => {
    assert.strictEqual(
      canonicalStorageKey(`${PUBLIC_URL}/uploads/a/../b/y.png`),
      "uploads/b/y.png",
    );
    assert.strictEqual(
      canonicalStorageKey(`${PUBLIC_URL}/uploads/a/%2e%2e/b/y.png`),
      "uploads/b/y.png",
    );
  });

  it("decodes percent-encoding so the key matches the stored object", () => {
    assert.strictEqual(
      canonicalStorageKey(`${PUBLIC_URL}/uploads/x/1-my%20file.png`),
      "uploads/x/1-my file.png",
    );
  });

  it("rejects non-bucket, malformed and ambiguous URLs", () => {
    for (const url of [
      "not-a-url",
      "",
      `${PUBLIC_URL}/`,
      `${PUBLIC_URL}.evil.test/uploads/x/y.png`,
      `http://files.example.test/uploads/x/y.png`,
      // Encoded dot inside a segment: not a dot-segment, so the parser leaves
      // it, but a later hop may decode it into one.
      `${PUBLIC_URL}/uploads/x/y%2e%2e%2fz.png`,
      // Malformed percent-encoding has no single canonical form.
      `${PUBLIC_URL}/uploads/x/%zz.png`,
      // Encoded separator would introduce a segment after decoding.
      `${PUBLIC_URL}/uploads/x%2F..%2Fy.png`,
      // Empty segment.
      `${PUBLIC_URL}/uploads//y.png`,
      // Backslash and control characters.
      `${PUBLIC_URL}/uploads/x/%5C..%5Cy.png`,
      `${PUBLIC_URL}/uploads/x/y%00.png`,
      `${PUBLIC_URL}/uploads/x/y%0d%0a.png`,
    ]) {
      assert.strictEqual(canonicalStorageKey(url), null, url);
    }
  });
});

describe("isStorageUrl", () => {
  it("accepts a URL under the public base", () => {
    assert.strictEqual(isStorageUrl(`${PUBLIC_URL}/uploads/x/y.png`), true);
  });

  it("rejects a host that merely starts with the base", () => {
    assert.strictEqual(
      isStorageUrl(`${PUBLIC_URL}.evil.test/uploads/x/y.png`),
      false,
    );
  });

  it("rejects a URL with no key at all", () => {
    assert.strictEqual(isStorageUrl(`${PUBLIC_URL}/`), false);
  });
});

describe("isOwnedUploadUrl", () => {
  it("accepts the caller's own upload prefix", () => {
    assert.strictEqual(
      isOwnedUploadUrl(`${PUBLIC_URL}/uploads/${USER_ID}/1-file.png`, USER_ID),
      true,
    );
  });

  it("rejects another user's upload prefix", () => {
    assert.strictEqual(
      isOwnedUploadUrl(
        `${PUBLIC_URL}/uploads/someone-else/1-file.png`,
        USER_ID,
      ),
      false,
    );
  });

  // Regression: the prefix check used to omit the `/` boundary and slice
  // `base.length + 1`, so this URL yielded the key `uploads/<uid>/x.png` and
  // passed the ownership check while pointing at an attacker-controlled host.
  it("rejects a host-suffix lookalike that fakes the uploads prefix", () => {
    assert.strictEqual(
      isOwnedUploadUrl(`${PUBLIC_URL}X/uploads/${USER_ID}/x.png`, USER_ID),
      false,
    );
    assert.strictEqual(
      isOwnedUploadUrl(
        `${PUBLIC_URL}.evil.test/uploads/${USER_ID}/x.png`,
        USER_ID,
      ),
      false,
    );
  });

  it("ignores a query string when reading the key", () => {
    assert.strictEqual(
      isOwnedUploadUrl(`${PUBLIC_URL}/uploads/${USER_ID}/x.png?v=2`, USER_ID),
      true,
    );
  });

  // Regression: the check used to prefix-match the raw slice, so a key that
  // *starts* with the caller's own directory but climbs back out of it passed
  // while resolving to the victim's object.
  it("rejects traversal out of the caller's own prefix", () => {
    const victim = "22222222-2222-2222-2222-222222222222";

    for (const url of [
      `${PUBLIC_URL}/uploads/${USER_ID}/../${victim}/file.pdf`,
      `${PUBLIC_URL}/uploads/${USER_ID}/%2e%2e/${victim}/file.pdf`,
      `${PUBLIC_URL}/uploads/${USER_ID}/%2E%2E/${victim}/file.pdf`,
      `${PUBLIC_URL}/uploads/${USER_ID}%2F..%2F${victim}/file.pdf`,
      `${PUBLIC_URL}/uploads/${USER_ID}/..%5C${victim}/file.pdf`,
    ]) {
      assert.strictEqual(isOwnedUploadUrl(url, USER_ID), false, url);
    }
  });

  it("rejects the prefix itself with no object beneath it", () => {
    assert.strictEqual(
      isOwnedUploadUrl(`${PUBLIC_URL}/uploads/${USER_ID}/`, USER_ID),
      false,
    );
  });

  it("rejects a userId that could widen the prefix", () => {
    assert.strictEqual(
      isOwnedUploadUrl(`${PUBLIC_URL}/uploads/x/y.png`, ""),
      false,
    );
    assert.strictEqual(
      isOwnedUploadUrl(`${PUBLIC_URL}/uploads/x/y.png`, ".."),
      false,
    );
  });
});

describe("isAllowedUploadContentType", () => {
  it("accepts the listed image, document and geospatial types", () => {
    for (const type of [
      "image/png",
      "image/jpeg",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
      "application/geo+json",
    ]) {
      assert.strictEqual(isAllowedUploadContentType(type), true, type);
    }
  });

  it("normalises casing and charset parameters", () => {
    assert.strictEqual(
      isAllowedUploadContentType("Application/PDF; charset=utf-8"),
      true,
    );
  });

  it("rejects the types a deny list used to miss", () => {
    for (const type of [
      "text/html",
      "image/svg+xml",
      "application/rdf+xml",
      "application/xhtml+xml; charset=utf-8",
      "text/plain",
      "text/csv",
      "application/octet-stream",
      "",
    ]) {
      assert.strictEqual(isAllowedUploadContentType(type), false, type);
    }
  });
});

describe("assertAllowedContentType", () => {
  it("passes an allowed type through", () => {
    assert.doesNotThrow(() => assertAllowedContentType("image/png"));
  });

  it("throws a 400-mapped validation error for anything else", () => {
    assert.throws(
      () => assertAllowedContentType("text/html"),
      (error: unknown) => {
        assert.ok(error instanceof UploadError);
        assert.strictEqual(error.message, "Unsupported file type");
        assert.strictEqual(error.code, UploadErrorCode.VALIDATION_ERROR);
        return true;
      },
    );
  });
});

describe("storage key format", () => {
  const UUID =
    "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

  it("uniqueStorageName prefixes a timestamp and a full random UUID", () => {
    const name = uniqueStorageName("report.pdf");
    assert.match(name, new RegExp(`^\\d{13}-${UUID}-report\\.pdf$`));
    assert.notStrictEqual(uniqueStorageName("report.pdf"), name);
  });

  it("presigned upload keys keep the uploads/{userId}/ prefix and carry a UUID", async () => {
    const { key, publicUrl } = await new UploadService().generatePresignedUrl(
      "letter.pdf",
      "application/pdf",
      1024,
      USER_ID,
    );
    assert.match(
      key,
      new RegExp(`^uploads/${USER_ID}/\\d{13}-${UUID}-letter\\.pdf$`),
    );
    assert.strictEqual(publicUrl, `${PUBLIC_URL}/${key}`);
    assert.ok(isOwnedUploadUrl(publicUrl, USER_ID));
  });
});
