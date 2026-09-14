import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { stripTelemetryHeaders } from "../lib/telemetry-proxy.js";

describe("stripTelemetryHeaders", () => {
  it("removes credential headers, keeps the rest, does not mutate input", () => {
    const incoming = new Headers({
      cookie: "authjs.session-token=secret",
      authorization: "Bearer abc",
      "x-api-key": "k",
      "content-type": "application/json",
      "user-agent": "test",
    });

    const out = stripTelemetryHeaders(incoming);

    assert.equal(out.get("cookie"), null);
    assert.equal(out.get("authorization"), null);
    assert.equal(out.get("x-api-key"), null);
    assert.equal(out.get("content-type"), "application/json");
    assert.equal(out.get("user-agent"), "test");
    // input untouched
    assert.equal(incoming.get("cookie"), "authjs.session-token=secret");
  });
});
