import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redactSensitiveUrl } from "../sentry-scrub";

describe("redactSensitiveUrl", () => {
  it("redacts sensitive params and keeps the rest intact", () => {
    assert.equal(
      redactSensitiveUrl("https://x.com/p?token=abc&b=1"),
      "https://x.com/p?token=[redacted]&b=1",
    );
    assert.equal(
      redactSensitiveUrl("https://x.com/verify?email=a@b.c#frag"),
      "https://x.com/verify?email=[redacted]#frag",
    );
  });

  it("matches the sensitive word anywhere in the param name", () => {
    assert.equal(
      redactSensitiveUrl(
        "https://bucket.s3.amazonaws.com/f?X-Amz-Signature=deadbeef&X-Amz-Security-Token=zzz&x=1",
      ),
      "https://bucket.s3.amazonaws.com/f?X-Amz-Signature=[redacted]&X-Amz-Security-Token=[redacted]&x=1",
    );
  });

  it("redacts a sensitive param nested in another param's value", () => {
    assert.equal(
      redactSensitiveUrl("/login?next=/verify?token=abc&x=1"),
      "/login?next=/verify?token=[redacted]&x=1",
    );
  });

  it("redacts params inside free text (exception messages)", () => {
    assert.equal(
      redactSensitiveUrl("GET https://x.com/?code=123 failed"),
      "GET https://x.com/?code=[redacted] failed",
    );
    assert.equal(redactSensitiveUrl("my token=abc"), "my token=[redacted]");
  });

  it("leaves URLs without sensitive params untouched", () => {
    const url = "https://app.example.com/projects?page=2&sort=name";
    assert.equal(redactSensitiveUrl(url), url);
  });

  it("stays linear on input that backtracked catastrophically", () => {
    const k = 16_000;
    const url = `Y${"?".repeat(k)}${"KEY".repeat(k)}#KEY=v`;
    const start = performance.now();
    const redacted = redactSensitiveUrl(url);
    const elapsedMs = performance.now() - start;
    assert.equal(redacted, `${url.slice(0, -1)}[redacted]`);
    assert.ok(elapsedMs < 250, `took ${elapsedMs}ms`);
  });
});
