import assert from "node:assert";
import { describe, it } from "node:test";
import { DrizzleQueryError } from "drizzle-orm";

import { isUniqueViolation } from "../src/db-client/errors";

const pgError = (code: string) => {
  return Object.assign(new Error("postgres error"), { code });
};

describe("isUniqueViolation", () => {
  it("detects a bare postgres unique violation", () => {
    assert.strictEqual(isUniqueViolation(pgError("23505")), true);
  });

  it("detects a unique violation wrapped in DrizzleQueryError", () => {
    const wrapped = new DrizzleQueryError("insert ...", [], pgError("23505"));
    assert.strictEqual(isUniqueViolation(wrapped), true);
  });

  it("ignores other postgres errors, wrapped or not", () => {
    assert.strictEqual(isUniqueViolation(pgError("23503")), false);
    assert.strictEqual(
      isUniqueViolation(new DrizzleQueryError("q", [], pgError("23503"))),
      false,
    );
  });

  it("ignores non-errors", () => {
    assert.strictEqual(isUniqueViolation({ code: "23505" }), false);
    assert.strictEqual(isUniqueViolation(undefined), false);
  });
});
