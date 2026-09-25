import assert from "node:assert";
import { describe, it } from "node:test";

import {
  collectAssigneeUserIds,
  formatProfileName,
} from "../src/queries/project-assignable-users";

const ID_A = "0b6f2c4e-8a1d-4c3b-9e7f-1a2b3c4d5e6f";
const ID_B = "7c8d9e0f-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

describe("collectAssigneeUserIds", () => {
  it("flattens and de-duplicates ids across lists", () => {
    const ids = collectAssigneeUserIds([[ID_A], [ID_A, ID_B], null]);

    assert.deepStrictEqual(ids.sort(), [ID_A, ID_B].sort());
  });

  it("normalises case so the same uuid is not counted twice", () => {
    const ids = collectAssigneeUserIds([[ID_A.toUpperCase()], [ID_A]]);

    assert.deepStrictEqual(ids, [ID_A]);
  });

  it("drops entries that are not uuids", () => {
    const ids = collectAssigneeUserIds([
      ["someone@example.test", "", "not-a-uuid", ID_B],
    ]);

    assert.deepStrictEqual(ids, [ID_B]);
  });

  it("returns an empty list when nothing is assigned", () => {
    assert.deepStrictEqual(collectAssigneeUserIds([]), []);
    assert.deepStrictEqual(collectAssigneeUserIds([null, []]), []);
  });
});

describe("formatProfileName", () => {
  it("joins first and last name", () => {
    assert.strictEqual(formatProfileName("Ada", "Lovelace"), "Ada Lovelace");
  });

  it("uses whichever half exists", () => {
    assert.strictEqual(formatProfileName("Ada", null), "Ada");
    assert.strictEqual(formatProfileName(null, "Lovelace"), "Lovelace");
  });

  it("returns null when the profile has no name", () => {
    assert.strictEqual(formatProfileName(null, null), null);
    assert.strictEqual(formatProfileName("  ", ""), null);
  });
});
