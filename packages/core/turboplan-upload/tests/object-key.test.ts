import assert from "node:assert";
import { describe, it } from "node:test";

import { isSafeObjectKey, MAX_OBJECT_KEY_CHARS } from "../src/types";

describe("isSafeObjectKey", () => {
  it("accepts keys that name one object of the bucket", () => {
    for (const key of [
      "letterheads/project/doc/logo-0-abc.png",
      "uploads/3b2a1c0d/1700000000000-uuid-Logo (final).png",
      "file.png",
      "a/.hidden/b..c/d.",
      "x".repeat(MAX_OBJECT_KEY_CHARS),
    ]) {
      assert.strictEqual(isSafeObjectKey(key), true, key);
    }
  });

  it("refuses empty, traversing, absolute, ambiguous and crafted keys", () => {
    for (const key of [
      "",
      "..",
      "../other-bucket/x.png",
      "a/../b",
      "a/./b",
      "./a",
      "/a",
      "a/",
      "a//b",
      "a\\b",
      "a\u0000b",
      "a\u001fb",
      "a\u007fb",
      "a\u0085b",
      "a\ud800b",
      "x".repeat(MAX_OBJECT_KEY_CHARS + 1),
    ]) {
      assert.strictEqual(isSafeObjectKey(key), false, JSON.stringify(key));
    }
  });
});
