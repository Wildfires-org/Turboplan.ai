import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyGridLetterheadEdit,
  GRID_LINE_SIZES,
  type GridLetterhead,
  gridLetterheadEditSchema,
  MAX_GRID_CELLS,
  type PublicGridLetterhead,
  strictGridLetterheadSchema,
  toPublicGridLetterhead,
} from "@wildfires-org/turboplan-workspace/types";

import {
  formErrorFromServer,
  formValuesToEdit,
  formValuesToPreview,
  type GridLetterheadFormCell,
  type GridLetterheadFormLogoCell,
  type GridLetterheadFormValues,
  gridLetterheadFormSchema,
  gridToFormValues,
  logoColumnIndex,
  MIN_NEW_CELL_WIDTH,
  newTextCell,
  withCellRemoved,
  withTextCellAdded,
  withUploadedLogo,
} from "../lib/grid-letterhead-form";

// A text cell as a grid stores it (no `valign`: at the top of the row).
const storedText = (x: number, width: number, lines = ["Agency"]) => ({
  kind: "text" as const,
  x,
  width,
  align: "left" as const,
  lines: lines.map((line) => ({
    text: line,
    bold: true,
    size: "normal" as const,
  })),
});

// The same cell as the form holds it, its vertical alignment spelled out.
const text = (x: number, width: number, lines = ["Agency"]) => ({
  ...storedText(x, width, lines),
  valign: "top" as const,
});

const logo = (
  x: number,
  width: number,
  height: number,
  index: number | null = 0,
  url: string | null = null,
): GridLetterheadFormLogoCell => ({
  kind: "logo",
  x,
  width,
  height,
  valign: "top",
  index,
  url,
});

// Cells as the strict schema sees them (a stand-in storage key for every
// logo).
const isTidy = (cells: readonly GridLetterheadFormCell[]) =>
  strictGridLetterheadSchema.safeParse({
    cells: cells.map((cell) =>
      cell.kind === "logo"
        ? {
            kind: "logo",
            x: cell.x,
            width: cell.width,
            height: cell.height,
            key: "letterheads/project/doc/logo.png",
          }
        : {
            kind: "text",
            x: cell.x,
            width: cell.width,
            align: cell.align,
            lines: [{ text: "x", bold: false, size: "normal" }],
          },
    ),
    color: null,
  }).success;

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≉ ${expected}`);

describe("gridToFormValues / formValuesToEdit", () => {
  const grid: PublicGridLetterhead = {
    cells: [
      { ...storedText(0.2, 0.6), align: "center" },
      { kind: "logo", x: 0, width: 0.15, height: 0.15, index: 0 },
    ],
    color: "#1f5f3a",
  };

  it("lists the cells left to right with their saved logo index", () => {
    const values = gridToFormValues(grid);

    assert.deepEqual(values.cells[0], logo(0, 0.15, 0.15, 0));
    assert.equal(values.cells[1].kind, "text");
    assert.equal(values.color, "#1f5f3a");
    assert.equal(gridToFormValues({ ...grid, color: null }).color, "");
  });

  it("keeps the grid's base text size, null without one", () => {
    assert.equal(gridToFormValues({ ...grid, fontSize: 0.02 }).fontSize, 0.02);
    assert.equal(gridToFormValues(grid).fontSize, null);
  });

  it("never sends the base text size (the server keeps the stored one)", () => {
    const edit = formValuesToEdit(
      gridToFormValues({ ...grid, fontSize: 0.02 }),
    );

    assert.equal(Object.hasOwn(edit, "fontSize"), false);
    assert.deepEqual(edit, formValuesToEdit(gridToFormValues(grid)));
    assert.equal(gridLetterheadEditSchema.safeParse(edit).success, true);
  });

  it("sends saved logos by index, uploads by URL and cleaned lines", () => {
    const values: GridLetterheadFormValues = {
      cells: [
        logo(0, 0.15, 0.15, 1),
        text(0.2, 0.4, ["  Bureau​ of  Land ", " "]),
        logo(0.7, 0.2, 0.1, null, "https://files.example.test/uploads/u/l.png"),
      ],
      color: "",
      fontSize: null,
    };

    assert.deepEqual(formValuesToEdit(values), {
      cells: [
        { kind: "logo", x: 0, width: 0.15, height: 0.15, index: 1 },
        storedText(0.2, 0.4, ["Bureau of Land"]),
        {
          kind: "logo",
          x: 0.7,
          width: 0.2,
          height: 0.1,
          url: "https://files.example.test/uploads/u/l.png",
        },
      ],
      color: null,
    });
  });

  it("round-trips a saved grid unchanged", () => {
    const edit = formValuesToEdit(gridToFormValues(grid));

    assert.deepEqual(edit, {
      cells: [
        { kind: "logo", x: 0, width: 0.15, height: 0.15, index: 0 },
        { ...storedText(0.2, 0.6), align: "center" },
      ],
      color: "#1f5f3a",
    });
  });
});

describe("a column's vertical alignment", () => {
  // The NFF letterhead: one wide logo (its wordmark included) at the bottom
  // of the row, the address centred beside it, a note at the top.
  const grid: PublicGridLetterhead = {
    cells: [
      {
        kind: "logo",
        x: 0,
        width: 0.45,
        height: 0.12,
        valign: "bottom",
        index: 0,
      },
      { ...storedText(0.5, 0.2), valign: "middle" },
      { ...storedText(0.75, 0.25), align: "right" },
    ],
    color: null,
  };

  it("is the grid's, or the top when it has none", () => {
    assert.deepEqual(
      gridToFormValues(grid).cells.map((cell) => cell.valign),
      ["bottom", "middle", "top"],
    );
  });

  it("is sent only when it is not the top (the server stores none for it)", () => {
    const values = gridToFormValues(grid);
    values.cells.push(
      logo(0.9, 0.1, 0.1, null, "https://files.example.test/u.png"),
    );
    const edit = formValuesToEdit(values);

    assert.deepEqual(
      edit.cells.map((cell) => [cell.kind, cell.valign]),
      [
        ["logo", "bottom"],
        ["text", "middle"],
        ["text", undefined],
        ["logo", undefined],
      ],
    );
    assert.equal(Object.hasOwn(edit.cells[2], "valign"), false);
    assert.equal(Object.hasOwn(edit.cells[3], "valign"), false);
    assert.equal(gridLetterheadEditSchema.safeParse(edit).success, true);
  });

  it("is previewed as the grid stores it, none for the top", () => {
    const values = gridToFormValues(grid);
    values.cells[1] = { ...values.cells[1], valign: "top" };
    values.cells[2] = { ...values.cells[2], valign: "bottom" };
    const { letterhead } = formValuesToPreview(values, []);

    assert.deepEqual(
      letterhead.grid.cells.map((cell) => cell.valign),
      ["bottom", undefined, "bottom"],
    );
    assert.equal(Object.hasOwn(letterhead.grid.cells[1], "valign"), false);
  });

  it("starts a new column at the top; a split one keeps its own", () => {
    const { cells, index } = withTextCellAdded([
      logo(0, 0.15, 0.15),
      { ...text(0.2, 0.8), valign: "middle" },
    ]);

    assert.equal(index, 2);
    assert.deepEqual(
      cells.map((cell) => cell.valign),
      ["top", "middle", "top"],
    );
    assert.deepEqual(
      withCellRemoved(cells, 2).map((cell) => cell.valign),
      ["top", "middle"],
    );
  });
});

const loaded = (src: string) => ({ src, isLoading: false });
const LOADING = { src: null, isLoading: true };

describe("formValuesToPreview", () => {
  it("numbers the preview's logos and picks each one's source", () => {
    const { letterhead, logoSrcs, logoLoading } = formValuesToPreview(
      {
        cells: [
          logo(0, 0.15, 0.15, 1),
          text(0.2, 0.5, ["Agency", ""]),
          logo(0.8, 0.2, 0.1, null, "https://files.example.test/new.png"),
        ],
        color: "#1E3A8A",
        fontSize: null,
      },
      [loaded("data:saved-0"), loaded("data:saved-1")],
    );

    assert.deepEqual(logoSrcs, [
      "data:saved-1",
      "https://files.example.test/new.png",
    ]);
    assert.deepEqual(logoLoading, [false, false]);
    assert.deepEqual(
      letterhead.grid.cells.map((cell) =>
        cell.kind === "logo" ? cell.index : cell.lines.length,
      ),
      [0, 1, 1],
    );
    assert.equal(letterhead.layout, "grid");
    assert.deepEqual(letterhead.nameLines, ["Agency"]);
    assert.equal(letterhead.color, "#1e3a8a");
  });

  it("marks a saved logo that is still loading, never an upload", () => {
    const { logoSrcs, logoLoading } = formValuesToPreview(
      {
        cells: [
          logo(0, 0.15, 0.15, 0),
          text(0.2, 0.5),
          logo(0.8, 0.2, 0.1, null, "https://files.example.test/new.png"),
        ],
        color: "",
        fontSize: null,
      },
      [LOADING, LOADING],
    );

    assert.deepEqual(logoSrcs, [null, "https://files.example.test/new.png"]);
    assert.deepEqual(logoLoading, [true, false]);
  });

  it("shows no colour while the colour is not a full hex", () => {
    const { letterhead } = formValuesToPreview(
      { cells: [text(0, 1)], color: "#1e3", fontSize: null },
      [],
    );

    assert.equal(letterhead.color, null);
  });

  it("draws at the grid's base text size, the default without one", () => {
    const withSize = formValuesToPreview(
      { cells: [text(0, 1)], color: "", fontSize: 0.02 },
      [],
    );
    const withoutSize = formValuesToPreview(
      { cells: [text(0, 1)], color: "", fontSize: null },
      [],
    );

    assert.equal(withSize.letterhead.grid.fontSize, 0.02);
    // Absent, not undefined: the grid has no size of its own.
    assert.equal(Object.hasOwn(withoutSize.letterhead.grid, "fontSize"), false);
  });
});

describe("withTextCellAdded", () => {
  it("takes the free space at the right end", () => {
    const { cells, index } = withTextCellAdded([text(0, 0.5)]);

    assert.equal(index, 1);
    assert.deepEqual(cells[1], newTextCell(0.5, 0.5));
    assert.ok(isTidy(cells));
  });

  it("otherwise splits the widest column and goes right after it", () => {
    const before = [
      logo(0, 0.15, 0.15),
      text(0.2, 0.6),
      logo(0.85, 0.15, 0.15, 1),
    ];
    const { cells, index } = withTextCellAdded(before);

    assert.equal(index, 2);
    assert.equal(cells.length, 4);
    close(cells[1].width, 0.3);
    close(cells[2].x, 0.5);
    close(cells[2].width, 0.3);
    assert.deepEqual(cells[3], before[2]);
    assert.ok(isTidy(cells));
  });

  it("gives a split last column the rest of the width", () => {
    const { cells } = withTextCellAdded([text(0, 0.3), text(0.3, 0.6)]);

    close(cells[2].x, 0.6);
    close(cells[2].x + cells[2].width, 1);
    assert.ok(isTidy(cells));
  });

  it("splits the widest text column even when a logo is wider", () => {
    const before = [logo(0, 0.6, 0.2), text(0.6, 0.15), text(0.75, 0.25)];
    const { cells, index } = withTextCellAdded(before);

    assert.equal(index, 3);
    assert.deepEqual(cells[0], before[0]);
    close(cells[2].width, 0.125);
    close(cells[3].x, 0.875);
    close(cells[3].x + cells[3].width, 1);
    assert.ok(isTidy(cells));
  });

  it("splits a logo, keeping its aspect, only when there is no text column", () => {
    const { cells } = withTextCellAdded([logo(0, 0.9, 0.3)]);

    assert.deepEqual(cells[0], logo(0, 0.45, 0.15));
    assert.ok(isTidy(cells));
  });

  it("starts an empty grid with one full-width column", () => {
    assert.deepEqual(withTextCellAdded([]), {
      cells: [newTextCell(0, 1)],
      index: 0,
    });
  });

  it("needs at least the minimum free width to append", () => {
    const width = 1 - MIN_NEW_CELL_WIDTH + 0.01;
    const { cells } = withTextCellAdded([text(0, width)]);

    // Split, not appended: the column keeps half, the new one the rest.
    close(cells[0].width, width / 2);
    close(cells[1].x + cells[1].width, 1);
  });
});

describe("withCellRemoved", () => {
  it("splits the space between two text neighbours", () => {
    const cells = withCellRemoved(
      [text(0, 0.3), text(0.3, 0.4), text(0.7, 0.3)],
      1,
    );

    assert.equal(cells.length, 2);
    close(cells[0].width, 0.5);
    close(cells[1].x, 0.5);
    close(cells[1].width, 0.5);
    assert.ok(isTidy(cells));
  });

  it("gives all of it to the only text neighbour, never to a logo", () => {
    const logoLeft = withCellRemoved(
      [logo(0, 0.15, 0.15), text(0.2, 0.4), text(0.6, 0.4)],
      1,
    );
    assert.deepEqual(logoLeft[0], logo(0, 0.15, 0.15));
    close(logoLeft[1].x, 0.2);
    close(logoLeft[1].width, 0.8);

    const logoRight = withCellRemoved(
      [text(0, 0.5), logo(0.5, 0.2, 0.2), logo(0.8, 0.2, 0.2, 1)],
      1,
    );
    close(logoRight[0].width, 0.7);
    assert.deepEqual(logoRight[1], logo(0.8, 0.2, 0.2, 1));
    assert.ok(isTidy(logoRight));
  });

  it("leaves a gap between logos", () => {
    const cells = withCellRemoved(
      [logo(0, 0.15, 0.15), text(0.2, 0.6), logo(0.85, 0.15, 0.15, 1)],
      1,
    );

    assert.deepEqual(cells, [logo(0, 0.15, 0.15), logo(0.85, 0.15, 0.15, 1)]);
  });

  it("removes the last cell", () => {
    assert.deepEqual(withCellRemoved([text(0, 1)], 0), []);
  });
});

describe("withUploadedLogo", () => {
  const saved = logo(0, 0.2, 0.2, 0);

  it("keeps the width and takes the new image's aspect", () => {
    assert.deepEqual(withUploadedLogo(saved, "https://f/u.png", 0.5), {
      ...logo(0, 0.2, 0.1, null, "https://f/u.png"),
    });
  });

  it("shrinks a logo that would be taller than the span", () => {
    const cell = withUploadedLogo(logo(0, 0.5, 0.2), "https://f/u.png", 4);

    close(cell.height, 1);
    close(cell.width, 0.25);
  });

  it("keeps the old box when the aspect is unknown", () => {
    assert.deepEqual(withUploadedLogo(saved, "https://f/u.png", null), {
      ...saved,
      index: null,
      url: "https://f/u.png",
    });
  });
});

describe("logoColumnIndex", () => {
  // The field array's ids, as useFieldArray keeps them, beside the cells.
  const ids = (...list: string[]) => list.map((id) => ({ id }));

  it("finds an upload's column where it is now, after columns moved", () => {
    // An upload started in column 2 ("b"); a text column was then added in
    // front of it.
    assert.equal(
      logoColumnIndex(
        ids("a", "new", "b"),
        [logo(0, 0.15, 0.15), text(0.2, 0.3), logo(0.85, 0.15, 0.15, 1)],
        "b",
      ),
      2,
    );
    // The logo column in front of it was removed: "b" is now first, and the
    // upload does not land on the other logo.
    assert.equal(
      logoColumnIndex(
        ids("b", "c"),
        [logo(0.85, 0.15, 0.15, 1), text(0, 0.8)],
        "b",
      ),
      0,
    );
  });

  it("drops an upload whose column is gone, or is not a logo column", () => {
    assert.equal(
      logoColumnIndex(
        ids("a", "c"),
        [logo(0, 0.15, 0.15), text(0.2, 0.8)],
        "b",
      ),
      null,
    );
    assert.equal(
      logoColumnIndex(
        ids("a", "c"),
        [logo(0, 0.15, 0.15), text(0.2, 0.8)],
        "c",
      ),
      null,
    );
  });
});

describe("formErrorFromServer", () => {
  const values: GridLetterheadFormValues = {
    cells: [logo(0, 0.15, 0.15, 0), text(0.2, 0.8, ["Agency", "Address"])],
    color: "#1f5f3a",
    fontSize: null,
  };

  it("marks the field the server names, with the message for that field", () => {
    assert.deepEqual(
      formErrorFromServer(
        "cells.0.url",
        "Column 1: upload the logo again",
        values,
      ),
      { path: "cells.0.url", message: "Upload the logo again" },
    );
    assert.deepEqual(
      formErrorFromServer(
        "cells.1.lines.1.text",
        "Column 2, line 2: Too big: expected string to have <=200 characters",
        values,
      ),
      {
        path: "cells.1.lines.1.text",
        message: "Too big: expected string to have <=200 characters",
      },
    );
    assert.deepEqual(
      formErrorFromServer("cells.1.lines", "Column 2: too few", values)?.path,
      "cells.1.lines",
    );
    assert.deepEqual(
      formErrorFromServer(
        "cells",
        "Letterhead: add some text or a logo",
        values,
      ),
      { path: "cells", message: "Add some text or a logo" },
    );
    assert.equal(
      formErrorFromServer("color", "Colour: invalid", values)?.path,
      "color",
    );
  });

  it("is null for a path the form does not have", () => {
    for (const field of [
      "cells.2.lines",
      "cells.1.lines.5.text",
      "cells.0.lines",
      "",
      "cells.1.lines.0.text.x",
    ]) {
      assert.equal(formErrorFromServer(field, "x: y", values), null, field);
    }
  });
});

// Deterministic pseudo-random numbers (mulberry32), so a failure replays.
const randomFrom = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("adding and removing columns (property)", () => {
  // The saved copy the editor opened: two logos around a text column (stored
  // by their R2 object keys).
  const stored: GridLetterhead = {
    cells: [
      {
        kind: "logo",
        x: 0,
        width: 0.12,
        height: 0.12,
        key: "letterheads/project/doc/l0.png",
      },
      {
        kind: "text",
        x: 0.15,
        width: 0.7,
        align: "center",
        lines: [
          { text: "Bureau of Land Management", bold: true, size: "large" },
        ],
      },
      {
        kind: "logo",
        x: 0.88,
        width: 0.12,
        height: 0.06,
        key: "letterheads/project/doc/l1.png",
      },
    ],
    color: "#1f5f3a",
  };

  it("keeps every edit valid end to end, whatever the order", () => {
    // Runs that reached the column cap (the property must cover it).
    let fullRuns = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = randomFrom(seed);
      let cells = gridToFormValues(toPublicGridLetterhead(stored)).cells;
      const steps: string[] = [];
      let isFull = false;

      for (let step = 0; step < 24; step += 1) {
        const canAdd = cells.length < MAX_GRID_CELLS;
        if (canAdd && (cells.length <= 1 || random() < 0.6)) {
          const added = withTextCellAdded(cells);
          cells = added.cells.map((cell, index) =>
            index === added.index && cell.kind === "text"
              ? {
                  ...cell,
                  lines: [
                    { text: `Line ${step}`, bold: false, size: "normal" },
                  ],
                }
              : cell,
          );
          steps.push(`add@${added.index}`);
        } else {
          const index = Math.floor(random() * cells.length);
          cells = withCellRemoved(cells, index);
          steps.push(`remove@${index}`);
        }

        const context = `seed ${seed}: ${steps.join(", ")}`;
        assert.ok(cells.length <= MAX_GRID_CELLS, context);
        isFull ||= cells.length === MAX_GRID_CELLS;
        if (cells.length === 0) {
          break;
        }

        const values = { cells, color: "#1f5f3a", fontSize: null };
        assert.ok(gridLetterheadFormSchema.safeParse(values).success, context);
        const edit = gridLetterheadEditSchema.safeParse(
          formValuesToEdit(values),
        );
        assert.ok(edit.success, context);
        const applied = applyGridLetterheadEdit(edit.data, stored, () => null);
        assert.ok(
          applied.ok,
          `${context}: ${applied.ok ? "" : `${applied.field} ${applied.message}`}`,
        );
        assert.equal(applied.grid.cells.length, cells.length, context);
      }
      fullRuns += isFull ? 1 : 0;
    }
    assert.ok(fullRuns > 20, `only ${fullRuns} runs reached ${MAX_GRID_CELLS}`);
  });
});

describe("gridLetterheadFormSchema", () => {
  it("names the line that has no text", () => {
    const result = gridLetterheadFormSchema.safeParse({
      cells: [text(0, 1, ["Agency", " ​ "])],
      color: "",
      fontSize: null,
    });

    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0].path, [
      "cells",
      0,
      "lines",
      1,
      "text",
    ]);
  });

  it("refuses a logo column with neither a saved logo nor an upload", () => {
    const result = gridLetterheadFormSchema.safeParse({
      cells: [logo(0, 0.15, 0.15, null, null), text(0.2, 0.8)],
      color: "",
      fontSize: null,
    });

    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0].path, ["cells", 0, "url"]);
    for (const cell of [
      logo(0, 0.15, 0.15, 0, null),
      logo(0, 0.15, 0.15, null, "https://files.example.test/u.png"),
    ]) {
      assert.equal(
        gridLetterheadFormSchema.safeParse({
          cells: [cell, text(0.2, 0.8)],
          color: "",
          fontSize: null,
        }).success,
        true,
      );
    }
  });

  it("refuses a colour that is not a hex, and no columns", () => {
    assert.equal(
      gridLetterheadFormSchema.safeParse({
        cells: [text(0, 1)],
        color: "red",
        fontSize: null,
      }).success,
      false,
    );
    assert.equal(
      gridLetterheadFormSchema.safeParse({
        cells: [],
        color: "",
        fontSize: null,
      }).success,
      false,
    );
    assert.equal(
      gridLetterheadFormSchema.safeParse({
        cells: [text(0, 1)],
        color: "#1F5F3A",
        fontSize: null,
      }).success,
      true,
    );
  });

  it("takes every line size, smallest to largest, and no other", () => {
    assert.deepEqual(GRID_LINE_SIZES, [
      "small",
      "normal",
      "large",
      "xlarge",
      "xxlarge",
    ]);
    const withSize = (size: string) =>
      gridLetterheadFormSchema.safeParse({
        cells: [
          {
            ...text(0, 1),
            lines: [{ text: "Agency", bold: false, size }],
          },
        ],
        color: "",
        fontSize: null,
      }).success;

    for (const size of GRID_LINE_SIZES) {
      assert.equal(withSize(size), true, size);
    }
    assert.equal(withSize("huge"), false);
  });

  it("takes the three vertical alignments of a column, and no other", () => {
    const withValign = (valign: string) =>
      gridLetterheadFormSchema.safeParse({
        cells: [
          { ...logo(0, 0.15, 0.15), valign },
          { ...text(0.2, 0.8), valign },
        ],
        color: "",
        fontSize: null,
      }).success;

    for (const valign of ["top", "middle", "bottom"]) {
      assert.equal(withValign(valign), true, valign);
    }
    assert.equal(withValign("center"), false);
    assert.equal(
      gridLetterheadFormSchema.safeParse({
        cells: [storedText(0, 1)],
        color: "",
        fontSize: null,
      }).success,
      false,
    );
  });

  it("never refuses the base text size, which no field shows", () => {
    for (const fontSize of [0.02, null]) {
      assert.equal(
        gridLetterheadFormSchema.safeParse({
          cells: [text(0, 1)],
          color: "",
          fontSize,
        }).success,
        true,
      );
    }
  });
});
