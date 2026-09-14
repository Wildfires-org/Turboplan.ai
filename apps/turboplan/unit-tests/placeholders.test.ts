import assert from "node:assert";
import { describe, it } from "node:test";

import {
  createPlaceholderRegex,
  parsePlaceholder,
  stripPlaceholderNotes,
  stripPlaceholderNotesInTableRows,
} from "../lib/placeholders";

const matchAll = (text: string): string[] => {
  return text.match(createPlaceholderRegex()) ?? [];
};

describe("placeholder token shapes (every unknown-field form)", () => {
  it("plain description", () => {
    assert.deepStrictEqual(matchAll("by [INSERT: comment deadline date] to:"), [
      "[INSERT: comment deadline date]",
    ]);
  });

  it("suggested value with street address", () => {
    const token =
      "[INSERT: office street address — suggested: 10811 Stockrest Springs Road]";
    assert.deepStrictEqual(matchAll(token), [token]);
  });

  it("suggested value with parentheses", () => {
    const token =
      "[INSERT: collaborative process partner — suggested: Middle Truckee River Watershed Forest Partnership (MTRWFP)]";
    assert.deepStrictEqual(matchAll(token), [token]);
  });

  it("suggested value containing a URL", () => {
    const token =
      "[INSERT: project web page URL — suggested: https://www.fs.usda.gov/project/]";
    assert.deepStrictEqual(matchAll(`online at: ${token}`), [token]);
  });

  it("suggested value containing an email address", () => {
    const token =
      "[INSERT: electronic comment submission email address — suggested: comments-pacificsouthwest-tahoetruckee@usda.gov]";
    assert.deepStrictEqual(matchAll(`to: ${token}.`), [token]);
  });

  it("suggested value with commas and abbreviations", () => {
    const token =
      "[INSERT: mailing address — suggested: 10811 Stockrest Springs Rd., Truckee, CA 96161]";
    assert.deepStrictEqual(matchAll(token), [token]);
  });

  it("suggested value with colons (business hours)", () => {
    const token =
      "[INSERT: office business hours — suggested: 8:00 a.m. to 4:30 p.m. Monday through Friday, excluding holidays]";
    assert.deepStrictEqual(matchAll(token), [token]);
  });

  it("placeholder inside a table row cell", () => {
    const row =
      "| United States Department of Agriculture | Forest Service | District | [INSERT: office phone number — suggested: (530) 587-3558] |";
    assert.deepStrictEqual(matchAll(row), [
      "[INSERT: office phone number — suggested: (530) 587-3558]",
    ]);
  });

  it("placeholder on a {right} letterhead line", () => {
    const line = "{right}**File Code:** [INSERT: file code — suggested: 1950]";
    assert.deepStrictEqual(matchAll(line), [
      "[INSERT: file code — suggested: 1950]",
    ]);
  });

  it("multiple placeholders in one paragraph", () => {
    const text =
      "directed to [INSERT: project contact name and title — suggested: John Brokaw, East Zone Environmental Coordinator] at [INSERT: project contact email — suggested: john.brokaw@usda.gov] or by phone at [INSERT: project contact phone — suggested: (530) 563-2235].";
    assert.strictEqual(matchAll(text).length, 3);
  });

  it("bare ALL-CAPS form", () => {
    assert.deepStrictEqual(matchAll("Sincerely,\n\n[DISTRICT RANGER NAME]"), [
      "[DISTRICT RANGER NAME]",
    ]);
  });

  it("does not match legal citations", () => {
    assert.deepStrictEqual(matchAll("under [SEE 40 C.F.R. § 1500] rules"), []);
  });

  it("does not match ordinary bracketed prose", () => {
    assert.deepStrictEqual(matchAll("the [proposed] action"), []);
  });
});

describe("reviewer notes (|| separator)", () => {
  it("extracts note and strips it from the visible form", () => {
    const parsed = parsePlaceholder(
      "[INSERT: file code — suggested: 1950 || verify against the office filing system]",
    );
    assert.strictEqual(parsed.desc, "file code — suggested: 1950");
    assert.strictEqual(parsed.note, "verify against the office filing system");
    assert.strictEqual(parsed.visible, "[INSERT: file code — suggested: 1950]");
  });

  it("no note yields empty note and identical visible form", () => {
    const parsed = parsePlaceholder("[INSERT: comment deadline date]");
    assert.strictEqual(parsed.note, "");
    assert.strictEqual(parsed.visible, "[INSERT: comment deadline date]");
  });

  it("stripPlaceholderNotes removes every note from a document", () => {
    const doc = [
      "Please submit by [INSERT: comment deadline date || 30 days from the letter date] to the office.",
      "{right}**File Code:** [INSERT: file code — suggested: 1950 || verify against the office filing system]",
      "Contact [INSERT: project contact email — suggested: john.brokaw@usda.gov || taken from the reference letter, confirm for this project].",
    ].join("\n\n");
    const stripped = stripPlaceholderNotes(doc);
    assert.ok(!stripped.includes("||"));
    assert.ok(stripped.includes("[INSERT: comment deadline date]"));
    assert.ok(stripped.includes("[INSERT: file code — suggested: 1950]"));
    assert.ok(
      stripped.includes(
        "[INSERT: project contact email — suggested: john.brokaw@usda.gov]",
      ),
    );
  });

  it("keeps note text for the docx comment even when it names a source", () => {
    const parsed = parsePlaceholder(
      "[INSERT: office business hours — suggested: 8:00 a.m. to 4:30 p.m. Monday through Friday || verify current hours against the district's official schedule]",
    );
    assert.strictEqual(
      parsed.note,
      "verify current hours against the district's official schedule",
    );
  });
});

describe("full letter smoke test", () => {
  it("finds every placeholder in a realistic scoping letter", () => {
    const letter = `| United States Department of Agriculture | Forest Service | Tahoe National Forest Truckee Ranger District | [INSERT: office street address — suggested: 10811 Stockrest Springs Road] |
|---|---|---|---|
| | | | [INSERT: city, state ZIP — suggested: Truckee, CA 96161] |
| | | | [INSERT: office phone number — suggested: (530) 587-3558] |

{right}**Fax:** [INSERT: office fax number — suggested: (530) 587-6114]

{right}**File Code:** [INSERT: file code — suggested: 1950]

{right}**Date:** July 21, 2026

A detailed description is available online at: [INSERT: project web page URL — suggested: https://www.fs.usda.gov/project/]

The project includes [INSERT: proposed treatment types — suggested: mechanical thinning, hand thinning, mastication, opening creation, hazard tree removal, tree planting, watershed measures, road actions, and prescribed burning]. Developed with the [INSERT: collaborative process partner — suggested: Middle Truckee River Watershed Forest Partnership (MTRWFP)].

Submit by [INSERT: comment deadline date] to: [INSERT: comment recipient name and title — suggested: District Ranger, Truckee Ranger District], [INSERT: mailing address — suggested: 10811 Stockrest Springs Rd., Truckee, CA 96161]. Hours: [INSERT: office business hours — suggested: 8:00 a.m. to 4:30 p.m. Monday through Friday, excluding holidays]. Email: [INSERT: electronic comment submission email address — suggested: comments-pacificsouthwest-tahoetruckee@usda.gov].

Directed to [INSERT: project contact name and title — suggested: John Brokaw, East Zone Environmental Coordinator, Truckee and Sierraville Ranger Districts, Tahoe National Forest] at [INSERT: project contact email — suggested: john.brokaw@usda.gov] or by phone at [INSERT: project contact phone — suggested: (530) 563-2235].

Sincerely,

[INSERT: District Ranger Name]
District Ranger, Truckee Ranger District`;

    const tokens = matchAll(letter);
    assert.strictEqual(tokens.length, 17);
    // Every token round-trips through the parser without losing its text.
    for (const token of tokens) {
      const { visible, note } = parsePlaceholder(token);
      assert.ok(visible.startsWith("[") && visible.endsWith("]"));
      assert.strictEqual(note, "");
    }
    // Stripping notes on a note-free letter is a no-op.
    assert.strictEqual(stripPlaceholderNotes(letter), letter);
  });
});

describe("stripPlaceholderNotesInTableRows", () => {
  it("drops the note from a placeholder inside a table row", () => {
    const row =
      "| USDA | Forest Service | Truckee Ranger District | [INSERT: office street address — suggested: 10811 Stockrest Springs Road || verify — taken from reference letter] |";
    assert.strictEqual(
      stripPlaceholderNotesInTableRows(row),
      "| USDA | Forest Service | Truckee Ranger District | [INSERT: office street address — suggested: 10811 Stockrest Springs Road] |",
    );
  });

  it("keeps notes on lines outside tables", () => {
    const text = [
      "| | | | [INSERT: office phone number || verify current number] |",
      "",
      "{right}**File Code:** [INSERT: file code || verify against the filing system]",
    ].join("\n");
    const stripped = stripPlaceholderNotesInTableRows(text);
    const lines = stripped.split("\n");
    assert.strictEqual(lines[0], "| | | | [INSERT: office phone number] |");
    assert.strictEqual(
      lines[2],
      "{right}**File Code:** [INSERT: file code || verify against the filing system]",
    );
  });

  it("restores GFM column counts so the table parses again", () => {
    const table = [
      "| A | B | C | [INSERT: address — suggested: 1 Main St || verify] |",
      "|---|---|---|---|",
      "| | | | [INSERT: phone || confirm] |",
    ].join("\n");
    const stripped = stripPlaceholderNotesInTableRows(table);
    for (const line of stripped.split("\n")) {
      assert.strictEqual(
        (line.match(/\|/g) ?? []).length,
        5,
        `row has phantom columns: ${line}`,
      );
    }
  });

  it("strips notes from GFM rows without a leading pipe", () => {
    const table = [
      "Agency | Address",
      "--- | ---",
      "USDA | [INSERT: office street address — suggested: 10811 Stockrest Springs Road || verify — taken from reference letter]",
    ].join("\n");
    const stripped = stripPlaceholderNotesInTableRows(table);
    assert.strictEqual(
      stripped.split("\n")[2],
      "USDA | [INSERT: office street address — suggested: 10811 Stockrest Springs Road]",
    );
  });

  it("strips a mid-stream table row before the delimiter row arrives", () => {
    const partialRow = "a | [INSERT: phone || confirm current number] | b";
    assert.strictEqual(
      stripPlaceholderNotesInTableRows(partialRow),
      "a | [INSERT: phone] | b",
    );
  });

  it("keeps the note when the line's only pipes are the note separator", () => {
    const line = "Call [INSERT: phone || confirm current number] today.";
    assert.strictEqual(stripPlaceholderNotesInTableRows(line), line);
  });

  it("is a no-op on note-free content", () => {
    const text =
      "| a | [INSERT: city, state ZIP — suggested: Truckee, CA 96161] |\n\nplain paragraph";
    assert.strictEqual(stripPlaceholderNotesInTableRows(text), text);
  });
});
