import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redactUrl, sanitizeProperties } from "../lib/posthog-sanitize.js";

describe("redactUrl", () => {
  it("redacts sensitive params, keeps the rest", () => {
    assert.equal(
      redactUrl("/check-email?email=a%40b.c&type=login"),
      "/check-email?email=[redacted]&type=login",
    );
    assert.equal(
      redactUrl("/verify?token=abc&userId=u1"),
      "/verify?token=[redacted]&userId=u1",
    );
    assert.equal(redactUrl("/projects?page=2"), "/projects?page=2");
  });

  it("redacts the invite token in the path, raw and URL-encoded", () => {
    assert.equal(
      redactUrl("https://app.example.test/invite/abc123XYZ"),
      "https://app.example.test/invite/[redacted]",
    );
    assert.equal(
      redactUrl("https://app.example.test/invite/abc123XYZ?x=1"),
      "https://app.example.test/invite/[redacted]?x=1",
    );
    assert.equal(
      redactUrl("/verify?type=login&next=%2Finvite%2Fabc123"),
      "/verify?type=login&next=%2Finvite%2F[redacted]",
    );
    assert.equal(redactUrl("/docs/invite-members"), "/docs/invite-members");
    assert.equal(redactUrl("/invite"), "/invite");
  });

  it("redacts callbackUrl and redirectTo (they carry invite and workspace paths)", () => {
    assert.equal(
      redactUrl("/login?email=a%40b.c&callbackUrl=%2Finvite%2Fabc123"),
      "/login?email=[redacted]&callbackUrl=[redacted]",
    );
    assert.equal(
      redactUrl(
        "/verify?token=t&type=login&redirectTo=%2Fjane-doe%2Fmain%2Fplan&setupProjectId=p1",
      ),
      "/verify?token=[redacted]&type=login&redirectTo=[redacted]&setupProjectId=p1",
    );
  });
});

describe("sanitizeProperties", () => {
  it("redacts URL-shaped props case-insensitively, leaves others", () => {
    const out = sanitizeProperties({
      $current_url: "https://app/x?token=t",
      $initial_referrer: "https://ref/?email=a@b.c",
      redirectUrl: "https://y/?secret=s",
      $pathname: "/verify?code=c",
      plain: "email=untouched-not-url-prop",
      count: 3,
    });
    assert.equal(out.$current_url, "https://app/x?token=[redacted]");
    assert.equal(out.$initial_referrer, "https://ref/?email=[redacted]");
    assert.equal(out.redirectUrl, "https://y/?secret=[redacted]");
    assert.equal(out.$pathname, "/verify?code=[redacted]");
    assert.equal(out.plain, "email=untouched-not-url-prop");
    assert.equal(out.count, 3);
  });
});
