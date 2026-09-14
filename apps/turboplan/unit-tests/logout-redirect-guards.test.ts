import assert from "node:assert";
import { describe, it } from "node:test";

import {
  isTrustedFetchSite,
  resolveRedirectTo,
  SAFE_REDIRECT_FALLBACK,
} from "../app/(auth)/logout/redirect-guards";

const LANDING_URL = "https://landing.turboplan.test";

describe("resolveRedirectTo", () => {
  describe("open redirect protection", () => {
    it("rejects an absolute URL on a foreign origin", () => {
      assert.strictEqual(
        resolveRedirectTo("https://evil.example", LANDING_URL),
        SAFE_REDIRECT_FALLBACK,
      );
    });

    it("rejects a protocol-relative URL", () => {
      assert.strictEqual(
        resolveRedirectTo("//evil", LANDING_URL),
        SAFE_REDIRECT_FALLBACK,
      );
    });

    it("rejects a backslash-normalised protocol-relative URL", () => {
      assert.strictEqual(
        resolveRedirectTo("/\\evil", LANDING_URL),
        SAFE_REDIRECT_FALLBACK,
      );
    });

    it("rejects a backslash-only protocol-relative URL", () => {
      assert.strictEqual(
        resolveRedirectTo("/\\\\evil.example", LANDING_URL),
        SAFE_REDIRECT_FALLBACK,
      );
    });

    it("rejects a userinfo-based origin spoof", () => {
      assert.strictEqual(
        resolveRedirectTo(`https://evil.example#@${LANDING_URL}`, LANDING_URL),
        SAFE_REDIRECT_FALLBACK,
      );
    });

    it("rejects a javascript: URL", () => {
      assert.strictEqual(
        resolveRedirectTo("javascript:alert(1)", LANDING_URL),
        SAFE_REDIRECT_FALLBACK,
      );
    });

    it("rejects a subdomain of the landing origin", () => {
      assert.strictEqual(
        resolveRedirectTo("https://evil.landing.turboplan.test", LANDING_URL),
        SAFE_REDIRECT_FALLBACK,
      );
    });

    it("rejects the landing host on a different scheme", () => {
      assert.strictEqual(
        resolveRedirectTo("http://landing.turboplan.test", LANDING_URL),
        SAFE_REDIRECT_FALLBACK,
      );
    });

    it("rejects a relative-looking value that is not a path", () => {
      assert.strictEqual(
        resolveRedirectTo("evil.example/path", LANDING_URL),
        SAFE_REDIRECT_FALLBACK,
      );
    });
  });

  describe("allowed targets", () => {
    it("passes through a same-origin relative path", () => {
      assert.strictEqual(
        resolveRedirectTo("/dashboard", LANDING_URL),
        "/dashboard",
      );
    });

    it("passes through a relative path with query and hash", () => {
      assert.strictEqual(
        resolveRedirectTo("/projects?tab=tasks#top", LANDING_URL),
        "/projects?tab=tasks#top",
      );
    });

    it("passes through the landing page origin", () => {
      assert.strictEqual(
        resolveRedirectTo(LANDING_URL, LANDING_URL),
        LANDING_URL,
      );
    });

    it("passes through a path on the landing page origin", () => {
      const target = `${LANDING_URL}/goodbye`;
      assert.strictEqual(resolveRedirectTo(target, LANDING_URL), target);
    });
  });

  describe("fallbacks", () => {
    it("falls back when no callbackUrl is given", () => {
      assert.strictEqual(
        resolveRedirectTo(undefined, LANDING_URL),
        SAFE_REDIRECT_FALLBACK,
      );
    });

    it("falls back on an empty callbackUrl", () => {
      assert.strictEqual(
        resolveRedirectTo("", LANDING_URL),
        SAFE_REDIRECT_FALLBACK,
      );
    });

    it("falls back when LANDING_URL is unset", () => {
      assert.strictEqual(
        resolveRedirectTo("https://landing.turboplan.test", ""),
        SAFE_REDIRECT_FALLBACK,
      );
    });

    it("keeps the fallback itself stable", () => {
      assert.strictEqual(SAFE_REDIRECT_FALLBACK, "/login");
      assert.strictEqual(
        resolveRedirectTo(SAFE_REDIRECT_FALLBACK, LANDING_URL),
        "/login",
      );
    });
  });
});

describe("isTrustedFetchSite", () => {
  for (const site of ["same-origin", "same-site", "none"]) {
    it(`accepts sec-fetch-site: ${site}`, () => {
      assert.strictEqual(isTrustedFetchSite(site), true);
    });
  }

  it("rejects sec-fetch-site: cross-site", () => {
    assert.strictEqual(isTrustedFetchSite("cross-site"), false);
  });

  it("rejects a missing header so the user gets the confirm button", () => {
    assert.strictEqual(isTrustedFetchSite(null), false);
  });

  it("rejects an empty header value", () => {
    assert.strictEqual(isTrustedFetchSite(""), false);
  });

  it("is case sensitive, matching the browser-emitted casing", () => {
    assert.strictEqual(isTrustedFetchSite("Same-Origin"), false);
  });
});
