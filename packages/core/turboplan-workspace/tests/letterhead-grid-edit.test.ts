import assert from "node:assert/strict";
import { describe, it } from "node:test";

const STORAGE = "https://files.example.test";
// A read-only alias of the same bucket (a second R2_PUBLIC_URL entry).
const ALIAS = "https://images.example.test";
const USER_ID = "3b2a1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d";
const OTHER_USER_ID = "0a7c9d2e-9999-4c3b-8d2e-3f4a5b6c7d8e";

// The real ownership rule (`ownedUploadKey`) reads all five R2 variables;
// uploads are owned under the first (write) base only.
Object.assign(process.env, {
  R2_ACCOUNT_ID: "test",
  R2_ACCESS_KEY_ID: "test",
  R2_SECRET_ACCESS_KEY: "test",
  R2_BUCKET_NAME: "test",
  R2_PUBLIC_URL: `${STORAGE},${ALIAS}`,
});

const { ownedUploadKey } = await import(
  "@wildfires-org/turboplan-upload/server"
);
const { MAX_GRID_LINE_CHARS } = await import("../src/letterhead-grid");
const { applyGridLetterheadEdit, gridLetterheadEditSchema } = await import(
  "../src/letterhead-grid-edit"
);
type GridLetterhead = import("../src/letterhead-grid").GridLetterhead;
type GridLetterheadEdit =
  import("../src/letterhead-grid-edit").GridLetterheadEdit;
type GridLetterheadEditCell =
  import("../src/letterhead-grid-edit").GridLetterheadEditCell;

const SEAL = "letterheads/project/ref/logo-0-abc.png";
const MARK = "letterheads/project/ref/logo-1-abc.png";
const UPLOAD_KEY = `uploads/${USER_ID}/1700000000000-new-logo.png`;
const UPLOAD = `${STORAGE}/${UPLOAD_KEY}`;

// Stored order is not left to right: `index` follows `gridLogoCells` (by x).
const stored: GridLetterhead = {
  cells: [
    { kind: "logo", x: 0.85, width: 0.15, height: 0.15, key: MARK },
    {
      kind: "text",
      x: 0.2,
      width: 0.6,
      align: "center",
      lines: [{ text: "Bureau of Land Management", bold: true, size: "large" }],
    },
    { kind: "logo", x: 0, width: 0.15, height: 0.15, key: SEAL },
  ],
  color: "#1f5f3a",
};

const text = (
  x: number,
  width: number,
  lines: string[] = ["Agency"],
): GridLetterheadEditCell => ({
  kind: "text",
  x,
  width,
  align: "left",
  lines: lines.map((line) => ({ text: line, bold: true, size: "normal" })),
});

const kept = (x: number, index: number): GridLetterheadEditCell => ({
  kind: "logo",
  x,
  width: 0.15,
  height: 0.15,
  index,
});

const uploaded = (x: number, url = UPLOAD): GridLetterheadEditCell => ({
  kind: "logo",
  x,
  width: 0.15,
  height: 0.1,
  url,
});

// What the server passes: the editing user's own upload → its key.
const ownedByUser = (url: string) => ownedUploadKey(url, USER_ID);

const apply = (edit: GridLetterheadEdit) =>
  applyGridLetterheadEdit(edit, stored, ownedByUser);

describe("applyGridLetterheadEdit", () => {
  it("maps kept logos by index (left to right) to the stored keys", () => {
    const result = apply({
      cells: [kept(0, 0), text(0.2, 0.6), kept(0.85, 1)],
      color: "#1F5F3A",
    });

    assert.equal(result.ok, true);
    assert.ok(result.ok);
    assert.deepEqual(
      result.grid.cells.map((cell) => (cell.kind === "logo" ? cell.key : "")),
      [SEAL, "", MARK],
    );
    // The colour is stored like every other letterhead colour: lowercase.
    assert.equal(result.grid.color, "#1f5f3a");
  });

  it("refuses an index the stored copy has no logo for", () => {
    const result = apply({ cells: [kept(0, 2), text(0.2, 0.6)], color: null });

    assert.deepEqual(result, {
      ok: false,
      field: "cells.0.index",
      message: "Column 1: this logo no longer exists",
    });
  });

  it("stores a new logo the user uploaded by its object key, not its URL", () => {
    const result = apply({
      cells: [uploaded(0, `${UPLOAD}?v=2`), text(0.2, 0.6)],
      color: null,
    });

    assert.ok(result.ok);
    assert.deepEqual(result.grid.cells[0], {
      kind: "logo",
      x: 0,
      width: 0.15,
      height: 0.1,
      key: UPLOAD_KEY,
    });
    assert.equal(JSON.stringify(result.grid).includes(STORAGE), false);
  });

  it("refuses a new logo URL the user does not own", () => {
    for (const url of [
      // Another user's upload, a reference logo (even under our base), the
      // same upload under a read-only alias, traversal, an external image,
      // a bare key.
      `${STORAGE}/uploads/${OTHER_USER_ID}/logo.png`,
      `${STORAGE}/${SEAL}`,
      `${ALIAS}/${UPLOAD_KEY}`,
      `${STORAGE}/uploads/${USER_ID}/../${OTHER_USER_ID}/logo.png`,
      `${STORAGE}/uploads/${USER_ID}/%2e%2e/${OTHER_USER_ID}/logo.png`,
      "https://evil.test/logo.png",
      UPLOAD_KEY,
    ]) {
      const result = apply({
        cells: [text(0, 0.5), uploaded(0.6, url)],
        color: null,
      });
      assert.deepEqual(
        result,
        {
          ok: false,
          field: "cells.1.url",
          message: "Column 2: upload the logo again",
        },
        url,
      );
    }
  });

  it("refuses an owned key that is not a letterhead logo key", () => {
    for (const key of [
      `org-logos/${USER_ID}.png`,
      `uploads/${USER_ID}/${"a".repeat(1100)}.png`,
    ]) {
      const result = applyGridLetterheadEdit(
        { cells: [text(0, 0.5), uploaded(0.6)], color: null },
        stored,
        () => key,
      );
      assert.deepEqual(
        result,
        {
          ok: false,
          field: "cells.1.url",
          message: "Column 2: upload the logo again",
        },
        key,
      );
    }
  });

  it("cleans every line and drops the ones left empty", () => {
    const result = apply({
      cells: [text(0, 1, ["  Bureau​ of\n Land   Management ", "­ \t", "x"])],
      color: null,
    });

    assert.ok(result.ok);
    const [cell] = result.grid.cells;
    assert.equal(cell.kind, "text");
    assert.deepEqual(
      cell.kind === "text" && cell.lines.map((line) => line.text),
      ["Bureau of Land Management", "x"],
    );
  });

  it("refuses a text cell with no line left once cleaned", () => {
    const result = apply({
      cells: [text(0, 0.5), text(0.5, 0.5, [" ", "​"])],
      color: null,
    });

    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.equal(result.field, "cells.1.lines");
    assert.match(result.message, /^Column 2: /);
  });

  it("refuses overlapping cells and cells past the right edge", () => {
    for (const cells of [
      [text(0, 0.6), text(0.5, 0.5)],
      [text(0, 0.5), text(0.6, 0.5)],
      [text(-0.1, 0.5)],
      [text(0, 0)],
    ]) {
      const result = apply({ cells, color: null });
      assert.equal(result.ok, false, JSON.stringify(cells));
    }
  });

  it("keeps float noise between neighbours", () => {
    const result = apply({
      cells: [text(0, 0.5 + 1e-4), text(0.5, 0.5)],
      color: null,
    });

    assert.equal(result.ok, true);
  });

  it("refuses an empty grid, a third logo and a bad colour", () => {
    const empty = apply({ cells: [], color: null });
    assert.ok(!empty.ok);
    assert.equal(empty.field, "cells");

    const threeLogos = apply({
      cells: [uploaded(0), uploaded(0.3), uploaded(0.6)],
      color: null,
    });
    assert.ok(!threeLogos.ok);
    assert.equal(threeLogos.field, "cells");

    const color = apply({ cells: [text(0, 1)], color: "green" });
    assert.ok(!color.ok);
    assert.equal(color.field, "color");
    assert.match(color.message, /^Colour: /);
  });

  it("stores only the known fields of each cell", () => {
    const result = apply({
      cells: [
        { ...text(0, 1), extra: "x" } as unknown as GridLetterheadEditCell,
      ],
      color: null,
    });

    assert.ok(result.ok);
    assert.deepEqual(Object.keys(result.grid.cells[0]).sort(), [
      "align",
      "kind",
      "lines",
      "width",
      "x",
    ]);
  });
});

describe("vertical alignment", () => {
  it("stores middle and bottom on text and logo cells, and top as none", () => {
    const result = apply({
      cells: [
        { ...kept(0, 0), valign: "bottom" },
        { ...text(0.2, 0.3), valign: "middle" },
        { ...text(0.5, 0.2), valign: "top" },
        { ...uploaded(0.85), valign: "middle" },
      ],
      color: null,
    });

    assert.ok(result.ok);
    assert.deepEqual(
      result.grid.cells.map((cell) =>
        "valign" in cell ? cell.valign : "none",
      ),
      ["bottom", "middle", "none", "middle"],
    );
    // A cell that does not say has none either.
    const plain = apply({ cells: [text(0, 1)], color: null });
    assert.ok(plain.ok);
    assert.equal("valign" in plain.grid.cells[0], false);
  });

  it("accepts the three alignments and the larger sizes in an edit, nothing else", () => {
    const parse = (cell: object) =>
      gridLetterheadEditSchema.safeParse({ cells: [cell], color: null })
        .success;
    for (const valign of ["top", "middle", "bottom"]) {
      assert.equal(parse({ ...text(0, 1), valign }), true, valign);
      assert.equal(parse({ ...kept(0, 0), valign }), true, valign);
      assert.equal(parse({ ...uploaded(0), valign }), true, valign);
    }
    assert.equal(parse({ ...text(0, 1), valign: "center" }), false);
    assert.equal(parse({ ...kept(0, 0), valign: "left" }), false);
    for (const size of ["xlarge", "xxlarge"]) {
      assert.equal(
        parse({ ...text(0, 1), lines: [{ text: "A", bold: true, size }] }),
        true,
        size,
      );
    }
  });
});

describe("base text size", () => {
  it("keeps the stored copy's, whatever the edit carries", () => {
    const edit = {
      cells: [text(0, 1)],
      color: null,
      fontSize: 0.5,
    } as GridLetterheadEdit;

    const sized = applyGridLetterheadEdit(
      edit,
      { ...stored, fontSize: 0.0123 },
      ownedByUser,
    );
    assert.ok(sized.ok);
    assert.equal(sized.grid.fontSize, 0.0123);

    const unsized = applyGridLetterheadEdit(edit, stored, ownedByUser);
    assert.ok(unsized.ok);
    assert.equal("fontSize" in unsized.grid, false);
  });

  it("is not part of the edit the editor sends", () => {
    const parsed = gridLetterheadEditSchema.parse({
      cells: [text(0, 1)],
      color: null,
      fontSize: 0.5,
    });
    assert.equal("fontSize" in parsed, false);
  });
});

describe("line length", () => {
  const withLine = (line: string): GridLetterheadEdit => ({
    cells: [text(0, 1, [line])],
    color: null,
  });

  it("refuses a line longer than MAX_GRID_LINE_CHARS once cleaned", () => {
    assert.equal(MAX_GRID_LINE_CHARS, 200);
    assert.equal(apply(withLine("a".repeat(200))).ok, true);

    const result = apply(withLine(` ${"a".repeat(201)} `));
    assert.ok(!result.ok);
    assert.equal(result.field, "cells.0.lines.0.text");
    assert.match(result.message, /^Column 1, line 1: /);
  });

  it("measures the cleaned text, not what cleaning drops", () => {
    // 200 visible characters among 600 invisible ones: 800 raw.
    const padded = `${"a\u200b\u200b\u200b".repeat(200)}`;
    assert.equal(padded.length, 800);

    const result = apply(withLine(padded));
    assert.ok(result.ok);
    const [cell] = result.grid.cells;
    assert.equal(cell.kind === "text" && cell.lines[0].text, "a".repeat(200));
  });

  it("refuses raw text over four times the cap before cleaning", () => {
    const parse = (line: string) =>
      gridLetterheadEditSchema.safeParse(withLine(line)).success;

    assert.equal(parse(" ".repeat(800)), true);
    assert.equal(parse(" ".repeat(801)), false);
  });
});

describe("gridLetterheadEditSchema", () => {
  it("accepts text cells, kept logos and new logos", () => {
    const edit = {
      cells: [kept(0, 0), text(0.2, 0.4), uploaded(0.7)],
      color: null,
    };

    assert.deepEqual(gridLetterheadEditSchema.parse(edit), edit);
  });

  it("refuses a logo cell with both an index and a URL, or neither", () => {
    for (const cell of [
      { kind: "logo", x: 0, width: 0.1, height: 0.1, index: 0, url: UPLOAD },
      { kind: "logo", x: 0, width: 0.1, height: 0.1 },
      { kind: "logo", x: 0, width: 0.1, height: 0.1, index: -1 },
      { kind: "logo", x: 0, width: 0.1, height: 0.1, index: 0.5 },
    ]) {
      assert.equal(
        gridLetterheadEditSchema.safeParse({ cells: [cell], color: null })
          .success,
        false,
        JSON.stringify(cell),
      );
    }
  });

  it("refuses more cells or lines than a grid may hold", () => {
    const nine = Array.from({ length: 9 }, (_, i) => text(i / 9, 1 / 9));
    assert.equal(
      gridLetterheadEditSchema.safeParse({ cells: nine, color: null }).success,
      false,
    );

    const thirteen = text(
      0,
      1,
      Array.from({ length: 13 }, () => "line"),
    );
    assert.equal(
      gridLetterheadEditSchema.safeParse({ cells: [thirteen], color: null })
        .success,
      false,
    );
  });
});
