import assert from "node:assert";
import { before, describe, it } from "node:test";

import { resetEnvCache } from "@wildfires-org/turboplan-env";

import {
  canonicalStorageKey,
  canonicalStorageUrl,
  generatePresignedUploadUrl,
  isAllowedStorageUrlUpdate,
  isOwnedUploadUrl,
  isStorageHost,
  isStorageUrl,
  ownedUploadKey,
} from "../src/server/r2-client";
import { uniqueStorageName } from "../src/server/storage-key";
import {
  assertAllowedContentType,
  sanitizeFilename,
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

// process.env stringifies values, so an unset variable must be deleted.
const setPublicUrl = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.R2_PUBLIC_URL;
  } else {
    process.env.R2_PUBLIC_URL = value;
  }
  resetEnvCache();
};

// Runs `check` with R2_PUBLIC_URL set to `value`, restoring the original.
const withPublicUrl = (value: string | undefined, check: () => void) => {
  const original = process.env.R2_PUBLIC_URL;
  setPublicUrl(value);
  try {
    check();
  } finally {
    setPublicUrl(original);
  }
};

const withPublicUrlAsync = async (
  value: string | undefined,
  check: () => Promise<void>,
) => {
  const original = process.env.R2_PUBLIC_URL;
  setPublicUrl(value);
  try {
    await check();
  } finally {
    setPublicUrl(original);
  }
};

const SECOND_PUBLIC_URL = "https://images.example.test";

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

  it("accepts a URL under any base of a comma-separated R2_PUBLIC_URL", () => {
    withPublicUrl(`${PUBLIC_URL}/, ${SECOND_PUBLIC_URL}`, () => {
      assert.strictEqual(isStorageUrl(`${PUBLIC_URL}/uploads/x/y.png`), true);
      assert.strictEqual(
        isStorageUrl(`${SECOND_PUBLIC_URL}/letterheads/p/d/logo-0-ab.png`),
        true,
      );
    });
  });

  it("stays strict under a comma-separated R2_PUBLIC_URL", () => {
    withPublicUrl(`${PUBLIC_URL},${SECOND_PUBLIC_URL}`, () => {
      for (const url of [
        `${SECOND_PUBLIC_URL}.evil.test/uploads/x/y.png`,
        "http://images.example.test/uploads/x/y.png",
        `${SECOND_PUBLIC_URL}/uploads//y.png`,
        `${SECOND_PUBLIC_URL}/uploads/x/y%2e%2e%2fz.png`,
        `${SECOND_PUBLIC_URL}/`,
        // The comma list itself is never a base.
        `${PUBLIC_URL},${SECOND_PUBLIC_URL}/uploads/x/y.png`,
        "http://169.254.169.254/latest/meta-data/x.png",
        "https://example.gov/uploads/x/y.png",
      ]) {
        assert.strictEqual(isStorageUrl(url), false, url);
      }
    });
  });

  it("accepts nothing when storage is not configured", () => {
    withPublicUrl(undefined, () => {
      assert.strictEqual(isStorageUrl(`${PUBLIC_URL}/uploads/x/y.png`), false);
    });
  });
});

describe("isStorageHost", () => {
  it("matches our host on any scheme, case or trailing dot, any path", () => {
    for (const url of [
      `${PUBLIC_URL}/uploads/x/y.png`,
      "http://files.example.test/uploads/x/y.png",
      "https://FILES.example.test/uploads/x/y.png",
      "https://files.example.test./uploads/x/y.png",
      "https://files.example.test:8443/uploads/x/y.png",
      `${PUBLIC_URL}/uploads//y.png`,
      `${PUBLIC_URL}/uploads/x/%zz.png`,
      ` ${PUBLIC_URL}/uploads/x/y.png `,
    ]) {
      assert.strictEqual(isStorageHost(url), true, url);
    }
  });

  it("rejects other hosts, lookalikes and non-URLs", () => {
    for (const url of [
      `${PUBLIC_URL}.evil.test/uploads/x/y.png`,
      "https://example.gov/files.example.test/y.png",
      "not-a-url",
      "",
    ]) {
      assert.strictEqual(isStorageHost(url), false, url);
    }
  });

  it("matches every base of a comma-separated R2_PUBLIC_URL", () => {
    withPublicUrl(`${PUBLIC_URL}/, ${SECOND_PUBLIC_URL}`, () => {
      assert.strictEqual(isStorageHost(`${PUBLIC_URL}/a.png`), true);
      assert.strictEqual(isStorageHost(`${SECOND_PUBLIC_URL}/a.png`), true);
      assert.strictEqual(isStorageHost("https://example.gov/a.png"), false);
    });
  });

  it("matches nothing when storage is not configured", () => {
    withPublicUrl(undefined, () => {
      assert.strictEqual(isStorageHost(`${PUBLIC_URL}/uploads/x/y.png`), false);
    });
  });
});

describe("canonicalStorageUrl", () => {
  it("gives one canonical URL for every spelling of an object", () => {
    const canonical = `${PUBLIC_URL}/uploads/x/1-my%20file.png`;
    for (const url of [
      `${PUBLIC_URL}/uploads/x/1-my file.png`,
      `${PUBLIC_URL}/uploads/x/1-my%20file.png?v=2#page=3`,
      `${PUBLIC_URL}/uploads/a/../x/1-my%20file.png`,
    ]) {
      assert.strictEqual(canonicalStorageUrl(url), canonical, url);
    }
  });

  it("keeps canonicalStorageKey's rejections", () => {
    for (const url of [
      "http://files.example.test/uploads/x/y.png",
      "https://files.example.test./uploads/x/y.png",
      `${PUBLIC_URL}/uploads//y.png`,
      `${PUBLIC_URL}/uploads/x/y%2e%2e%2fz.png`,
      `${PUBLIC_URL}/uploads/x/%zz.png`,
      `${PUBLIC_URL}/`,
      "https://example.gov/uploads/x/y.png",
    ]) {
      assert.strictEqual(canonicalStorageUrl(url), null, url);
    }
  });

  it("maps each base of a comma-separated R2_PUBLIC_URL to its own URL", () => {
    withPublicUrl(`${PUBLIC_URL},${SECOND_PUBLIC_URL}/`, () => {
      assert.strictEqual(
        canonicalStorageUrl(`${SECOND_PUBLIC_URL}/uploads/x/y.png`),
        `${SECOND_PUBLIC_URL}/uploads/x/y.png`,
      );
      assert.strictEqual(
        canonicalStorageUrl(`${PUBLIC_URL}/uploads/x/y.png`),
        `${PUBLIC_URL}/uploads/x/y.png`,
      );
    });
  });
});

// R2_PUBLIC_URL as a list: the first base is where objects are written and
// owned; the others are read-only aliases — ours, but owned by no one.
describe("a comma-separated R2_PUBLIC_URL", () => {
  const LIST = ` ${PUBLIC_URL}/ , ${SECOND_PUBLIC_URL}`;
  const owner = { userId: USER_ID };

  it("builds public URLs on the first base", async () => {
    await withPublicUrlAsync(LIST, async () => {
      const { publicUrl, key } = await generatePresignedUploadUrl(
        `uploads/${USER_ID}/a.png`,
        "image/png",
        10,
      );
      assert.strictEqual(publicUrl, `${PUBLIC_URL}/${key}`);
    });
  });

  it("resolves keys, ownership and updates under the first base", () => {
    withPublicUrl(LIST, () => {
      const url = `${PUBLIC_URL}/uploads/${USER_ID}/a.png`;
      assert.strictEqual(canonicalStorageKey(url), `uploads/${USER_ID}/a.png`);
      assert.strictEqual(isOwnedUploadUrl(url, USER_ID), true);
      assert.strictEqual(isAllowedStorageUrlUpdate(url, null, owner), true);
    });
  });

  it("accepts a URL under a later base as ours but refuses to own it", () => {
    withPublicUrl(LIST, () => {
      const alias = `${SECOND_PUBLIC_URL}/uploads/${USER_ID}/a.png`;
      assert.strictEqual(isStorageUrl(alias), true);
      assert.strictEqual(canonicalStorageKey(alias), null);
      assert.strictEqual(isOwnedUploadUrl(alias, USER_ID), false);
      assert.strictEqual(isAllowedStorageUrlUpdate(alias, null, owner), false);
      // Unchanged values stay allowed, as for any stored URL.
      assert.strictEqual(isAllowedStorageUrlUpdate(alias, alias, owner), true);
    });
  });

  it("refuses a malformed URL or another scheme on any listed host", () => {
    withPublicUrl(LIST, () => {
      for (const url of [
        `${SECOND_PUBLIC_URL}/uploads//a.png`,
        `http://images.example.test/uploads/${USER_ID}/a.png`,
        `http://files.example.test/uploads/${USER_ID}/a.png`,
        `https://files.example.test:8443/uploads/${USER_ID}/a.png`,
      ]) {
        assert.strictEqual(isAllowedStorageUrlUpdate(url, null, owner), false);
      }
      assert.strictEqual(
        isAllowedStorageUrlUpdate("https://cdn.other.test/l.png", null, owner),
        true,
      );
    });
  });
});

describe("storage URL spelling", () => {
  it("refuses userinfo, even on our own origin", () => {
    for (const url of [
      `https://user@files.example.test/uploads/${USER_ID}/a.png`,
      `https://user:pass@files.example.test/uploads/${USER_ID}/a.png`,
      `https://:pass@files.example.test/uploads/${USER_ID}/a.png`,
    ]) {
      assert.strictEqual(canonicalStorageKey(url), null, url);
      assert.strictEqual(isStorageUrl(url), false, url);
      assert.strictEqual(isOwnedUploadUrl(url, USER_ID), false, url);
      // On our host, so a write check never treats it as an external link.
      assert.strictEqual(
        isAllowedStorageUrlUpdate(url, null, { userId: USER_ID }),
        false,
        url,
      );
    }
  });

  it("accepts the scheme's default port and refuses any other", () => {
    assert.strictEqual(
      canonicalStorageKey("https://files.example.test:443/uploads/x/y.png"),
      "uploads/x/y.png",
    );
    assert.strictEqual(
      canonicalStorageKey("https://files.example.test:8443/uploads/x/y.png"),
      null,
    );
  });

  it("refuses a trailing-dot host, which is another origin", () => {
    assert.strictEqual(
      canonicalStorageKey("https://files.example.test./uploads/x/y.png"),
      null,
    );
  });

  it("compares IDN hosts in their punycode form", () => {
    // A lookalike with a non-ASCII letter is another host.
    assert.strictEqual(
      canonicalStorageKey("https://fïles.example.test/uploads/x/y.png"),
      null,
    );
    assert.strictEqual(
      isStorageHost("https://fïles.example.test/uploads/x/y.png"),
      false,
    );

    withPublicUrl("https://bücher.example.test", () => {
      for (const url of [
        "https://bücher.example.test/uploads/x/y.png",
        "https://xn--bcher-kva.example.test/uploads/x/y.png",
        "https://BÜCHER.example.test/uploads/x/y.png",
      ]) {
        assert.strictEqual(canonicalStorageKey(url), "uploads/x/y.png", url);
      }
      assert.strictEqual(
        canonicalStorageKey("https://bucher.example.test/uploads/x/y.png"),
        null,
      );
    });
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

describe("ownedUploadKey", () => {
  it("gives the canonical key of the caller's own upload", () => {
    assert.strictEqual(
      ownedUploadKey(
        `${PUBLIC_URL}/uploads/${USER_ID}/1-logo.png?v=2`,
        USER_ID,
      ),
      `uploads/${USER_ID}/1-logo.png`,
    );
    assert.strictEqual(
      ownedUploadKey(
        `${PUBLIC_URL}/uploads/${USER_ID}/1-my%20logo.png`,
        USER_ID,
      ),
      `uploads/${USER_ID}/1-my logo.png`,
    );
  });

  it("is null for anything that is not the caller's own upload", () => {
    const victim = "22222222-2222-2222-2222-222222222222";
    for (const url of [
      `${PUBLIC_URL}/uploads/${victim}/1-logo.png`,
      `${PUBLIC_URL}/letterheads/project/doc/logo-0-abc.png`,
      `${PUBLIC_URL}/org-logos/${USER_ID}.png`,
      `${PUBLIC_URL}/uploads/${USER_ID}/../${victim}/1-logo.png`,
      `${PUBLIC_URL}/uploads/${USER_ID}/%2e%2e/${victim}/1-logo.png`,
      `${PUBLIC_URL}/uploads/${USER_ID}/`,
      `https://cdn.other.test/uploads/${USER_ID}/1-logo.png`,
      `uploads/${USER_ID}/1-logo.png`,
      "",
    ]) {
      assert.strictEqual(ownedUploadKey(url, USER_ID), null, url);
    }
  });

  it("is null under a read-only alias base", () => {
    withPublicUrl(`${PUBLIC_URL},${SECOND_PUBLIC_URL}`, () => {
      assert.strictEqual(
        ownedUploadKey(
          `${SECOND_PUBLIC_URL}/uploads/${USER_ID}/1-logo.png`,
          USER_ID,
        ),
        null,
      );
      assert.strictEqual(
        ownedUploadKey(`${PUBLIC_URL}/uploads/${USER_ID}/1-logo.png`, USER_ID),
        `uploads/${USER_ID}/1-logo.png`,
      );
    });
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
      "application/vnd.google-earth.kmz",
      "application/geopackage+sqlite3",
      // KML is stored as plain text, never as its +xml type
      "text/plain",
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
      // Browsers render +xml types as XML documents (script via XHTML)
      "application/vnd.google-earth.kml+xml",
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

describe("generatePresignedUploadUrl", () => {
  // Built offline from dummy credentials: presigning never touches the network.
  const presignedParams = async (contentType: string) => {
    const { uploadUrl } = await generatePresignedUploadUrl(
      "landing-uploads/x.pdf",
      contentType,
      1024,
    );
    return new URL(uploadUrl).searchParams;
  };

  it("signs the Content-Type, so a PUT with another type is refused", async () => {
    const params = await presignedParams("application/pdf");
    const signed = params.get("X-Amz-SignedHeaders")?.split(";") ?? [];

    assert.ok(signed.includes("content-type"), signed.join(";"));
    assert.ok(signed.includes("content-length"), signed.join(";"));
    assert.ok(signed.includes("host"), signed.join(";"));
  });

  it("carries no checksum of an empty body", async () => {
    const params = await presignedParams("application/pdf");
    const names = [...params.keys()].map((name) => name.toLowerCase());

    assert.ok(
      !names.some((name) => name.startsWith("x-amz-checksum-")),
      names.join(","),
    );
    assert.ok(!names.includes("x-amz-sdk-checksum-algorithm"), names.join(","));
  });

  it("signs the type for both the authenticated and the landing presign", async () => {
    const service = new UploadService();
    for (const { uploadUrl } of [
      await service.generatePresignedUrl(
        "a.pdf",
        "application/pdf",
        10,
        USER_ID,
      ),
      await service.generateLandingPresignedUrl("a.pdf", "application/pdf", 10),
    ]) {
      const signed = new URL(uploadUrl).searchParams.get("X-Amz-SignedHeaders");
      assert.ok(signed?.split(";").includes("content-type"), String(signed));
    }
  });
});

describe("sanitizeFilename", () => {
  const hasLoneSurrogate = (value: string) => /\p{Cs}/u.test(value);

  it("never cuts an emoji in half when shortening a long name", () => {
    // 251 code units are left before ".pdf", so a cut by code units would end
    // on the high half of the 126th emoji.
    const sanitized = sanitizeFilename(`${"😀".repeat(300)}.pdf`);

    assert.strictEqual(sanitized, `${"😀".repeat(125)}.pdf`);
    assert.ok(sanitized.length <= 255);
    assert.ok(!hasLoneSurrogate(sanitized));
    assert.doesNotThrow(() => encodeURIComponent(sanitized));
  });

  it("drops lone surrogate halves from crafted input", () => {
    const sanitized = sanitizeFilename("a\uD83Db\uDE00c😀.pdf");

    assert.strictEqual(sanitized, "abc😀.pdf");
    assert.doesNotThrow(() => encodeURIComponent(sanitized));
  });

  it("presigns a long emoji name instead of failing with URI malformed", async () => {
    const { key } = await new UploadService().generatePresignedUrl(
      `${"😀".repeat(300)}.pdf`,
      "application/pdf",
      10,
      USER_ID,
    );

    assert.ok(key.endsWith(`${"😀".repeat(125)}.pdf`), key);
    assert.doesNotThrow(() => encodeURIComponent(key));
  });
});
