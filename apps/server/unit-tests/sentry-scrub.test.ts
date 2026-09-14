import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ErrorEvent } from "@sentry/core";

import { redactSensitiveUrl, scrubSentryEvent } from "../src/utils/sentry.js";

describe("redactSensitiveUrl", () => {
  it("redacts sensitive params and keeps the rest intact", () => {
    assert.equal(
      redactSensitiveUrl(
        "/welcome?token=abc&X-Amz-Signature=sig&code=SEC&next=/x",
      ),
      "/welcome?token=[redacted]&X-Amz-Signature=[redacted]&code=[redacted]&next=/x",
    );
  });

  it("matches the sensitive word anywhere in the param name", () => {
    assert.equal(
      redactSensitiveUrl(
        "https://r2.example.com/f?X-Amz-Security-Token=t&filter=a",
      ),
      "https://r2.example.com/f?X-Amz-Security-Token=[redacted]&filter=a",
    );
  });

  it("redacts email params (check-email flow)", () => {
    assert.equal(
      redactSensitiveUrl("/check-email?email=user%40example.com&type=login"),
      "/check-email?email=[redacted]&type=login",
    );
  });

  it("leaves URLs without sensitive params untouched", () => {
    const url = "https://app.example.com/projects?page=2&sort=name";
    assert.equal(redactSensitiveUrl(url), url);
  });
});

describe("scrubSentryEvent", () => {
  it("strips auth headers, cookies, and redacts urls everywhere", () => {
    const event = {
      request: {
        url: "https://app.example.com/magic?token=abc",
        query_string: "token=abc&a=1",
        cookies: { session: "s" },
        data: { magicLinkUrl: "https://app/verify?token=abc" },
        headers: {
          Authorization: "Bearer secret",
          Cookie: "sid=1",
          "x-api-key": "k",
          Accept: "application/json",
        },
      },
      breadcrumbs: [
        { data: { url: "https://x.example.com/cb?secret=s&ok=1" } },
        {
          data: {
            from: "/verify?token=t1&userId=u1",
            to: "/dashboard?key=k1",
          },
        },
      ],
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);

    assert.equal(scrubbed.request?.cookies, undefined);
    assert.equal(scrubbed.request?.data, undefined);
    assert.deepEqual(scrubbed.request?.headers, {
      Accept: "application/json",
    });
    assert.equal(
      scrubbed.request?.url,
      "https://app.example.com/magic?token=[redacted]",
    );
    assert.equal(scrubbed.request?.query_string, "token=[redacted]&a=1");
    assert.equal(
      scrubbed.breadcrumbs?.[0]?.data?.url,
      "https://x.example.com/cb?secret=[redacted]&ok=1",
    );
    assert.equal(
      scrubbed.breadcrumbs?.[1]?.data?.from,
      "/verify?token=[redacted]&userId=u1",
    );
    assert.equal(
      scrubbed.breadcrumbs?.[1]?.data?.to,
      "/dashboard?key=[redacted]",
    );
  });
});
