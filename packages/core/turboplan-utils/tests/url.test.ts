import assert from "node:assert";
import { describe, it } from "node:test";

import { isSafeHttpUrl, safeExternalUrl } from "../src/url";

describe("isSafeHttpUrl", () => {
  it("accepts http and https URLs", () => {
    assert.strictEqual(isSafeHttpUrl("https://example.com/doc.pdf"), true);
    assert.strictEqual(isSafeHttpUrl("http://example.com"), true);
    assert.strictEqual(isSafeHttpUrl("HTTPS://EXAMPLE.COM/a?b=c#d"), true);
  });

  it("rejects script-capable and non-web schemes", () => {
    assert.strictEqual(isSafeHttpUrl("javascript:alert(1)"), false);
    assert.strictEqual(isSafeHttpUrl("JaVaScRiPt:alert(1)"), false);
    assert.strictEqual(isSafeHttpUrl(" javascript:alert(1)"), false);
    assert.strictEqual(isSafeHttpUrl("java\tscript:alert(1)"), false);
    assert.strictEqual(
      isSafeHttpUrl("data:text/html,<script>alert(1)</script>"),
      false,
    );
    assert.strictEqual(isSafeHttpUrl("vbscript:msgbox(1)"), false);
    assert.strictEqual(isSafeHttpUrl("file:///etc/passwd"), false);
    assert.strictEqual(isSafeHttpUrl("ftp://example.com"), false);
    assert.strictEqual(isSafeHttpUrl("blob:https://example.com/x"), false);
  });

  it("rejects relative, malformed and empty values", () => {
    assert.strictEqual(isSafeHttpUrl("/relative/path"), false);
    assert.strictEqual(isSafeHttpUrl("not a url"), false);
    assert.strictEqual(isSafeHttpUrl(""), false);
    assert.strictEqual(isSafeHttpUrl(null), false);
    assert.strictEqual(isSafeHttpUrl(undefined), false);
  });
});

describe("safeExternalUrl", () => {
  it("returns the URL unchanged when it is http(s)", () => {
    assert.strictEqual(
      safeExternalUrl("https://example.com/a"),
      "https://example.com/a",
    );
  });

  it("returns undefined for unsafe URLs", () => {
    assert.strictEqual(safeExternalUrl("javascript:alert(1)"), undefined);
    assert.strictEqual(safeExternalUrl(null), undefined);
  });
});
