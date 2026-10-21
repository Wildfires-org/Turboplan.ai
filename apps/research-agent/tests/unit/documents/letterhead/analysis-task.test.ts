import { describe, expect, it } from "vitest";

import type {
  Box,
  PdfTextItem,
} from "@wildfires-org/turboplan-document-extraction/letterhead";

import {
  type LetterheadTaskDeps,
  locateLogos,
  type RenderedHeader,
  readInkColor,
  runLetterheadTask,
  withBlockInk,
} from "../../../../src/documents/letterhead/analysis-task";
import type { LetterheadReading } from "../../../../src/documents/letterhead/letterhead-request";

const URL = "https://files.example.com/letter.pdf";
const WIDTH = 1568;
const HEIGHT = 609;
const PAGE = { width: WIDTH, height: 2029 };

const box = (x: number, y: number, width: number, height: number): Box => ({
  x,
  y,
  width,
  height,
});

/** Opaque white RGBA header with rectangles painted on it in a colour. */
const paint = (
  rects: Box[],
  [r, g, b]: [number, number, number] = [0, 0, 0],
): Uint8ClampedArray => {
  const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(255);
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        const p = (y * WIDTH + x) * 4;
        rgba[p] = r;
        rgba[p + 1] = g;
        rgba[p + 2] = b;
      }
    }
  }
  return rgba;
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const CROP = new Uint8Array([0xc8]);

const header = (overrides: Partial<RenderedHeader> = {}): RenderedHeader => ({
  png: PNG,
  rgba: paint([]),
  width: WIDTH,
  height: HEIGHT,
  page: PAGE,
  imageBoxes: [],
  textItems: [],
  cropPng: () => CROP,
  ...overrides,
});

const line = (
  text: string,
  x: number,
  y: number,
  width: number,
  bold: boolean | null = null,
): PdfTextItem => ({ text, box: box(x, y, width, 20), bold });

// Agency letter: seal left, a bold three-line name column, an address right.
const seal = box(72, 92, 144, 144);
const boldColumn = box(246, 112, 180, 90);
const nameBlock = {
  role: "name" as const,
  lines: ["United States"],
  box: box(240, 106, 200, 100),
};
const addressBlock = {
  role: "contact" as const,
  lines: ["1 Main St"],
  box: box(1200, 110, 300, 110),
};

type ReadingOutput = Extract<LetterheadReading, { ok: true }>["output"];
// A block as the model answers it; one that does not say is no wordmark.
type ReadingBlock = Omit<ReadingOutput["blocks"][number], "wordmark"> & {
  wordmark?: boolean;
};

const reading = ({
  hasLetterhead = true,
  blocks = [nameBlock, addressBlock],
}: {
  hasLetterhead?: boolean;
  blocks?: ReadingBlock[];
} = {}): LetterheadReading => ({
  ok: true,
  output: {
    hasLetterhead,
    blocks: blocks.map((block) => ({ wordmark: false, ...block })),
  },
  inputTokens: 1650,
  outputTokens: 240,
});

/** A clock that advances 100 ms per reading. */
const tickingClock = () => {
  let time = 0;
  return () => {
    time += 100;
    return time;
  };
};

const deps = (overrides: Partial<LetterheadTaskDeps> = {}) => {
  const calls = { download: 0, render: 0, model: [] as unknown[] };
  const value: LetterheadTaskDeps = {
    download: async () => {
      calls.download += 1;
      return { ok: true, buffer: Buffer.from("%PDF-1.7") };
    },
    renderHeader: async () => {
      calls.render += 1;
      return header({ imageBoxes: [seal] });
    },
    readLetterhead: async (image) => {
      calls.model.push(image);
      return reading();
    },
    signal: new AbortController().signal,
    now: tickingClock(),
    ...overrides,
  };
  return { deps: value, calls };
};

const kinds = (result: LetterheadTaskResultLike) =>
  result.ok ? result.analysis.grid?.cells.map((cell) => cell.kind) : undefined;

type LetterheadTaskResultLike = Awaited<ReturnType<typeof runLetterheadTask>>;

describe("locateLogos", () => {
  it("uses the images the PDF places when one is a logo candidate", () => {
    expect(
      locateLogos(header({ imageBoxes: [seal], rgba: paint([boldColumn]) })),
    ).toEqual({ source: "pdf", boxes: [seal] });
  });

  it("falls back to pixel marks for a scan (one page-sized image)", () => {
    expect(
      locateLogos(
        header({
          imageBoxes: [box(0, 0, PAGE.width, PAGE.height)],
          rgba: paint([seal]),
        }),
      ),
    ).toEqual({ source: "pixels", boxes: [seal] });
  });

  it("finds none on a text-only page", () => {
    expect(locateLogos(header())).toEqual({ source: "none", boxes: [] });
  });
});

describe("readInkColor", () => {
  const blockPrinting = (printed: PdfTextItem | null) => ({
    ...nameBlock,
    matched: [{ text: "United States", printed }],
  });

  it("reads the colour of the letterhead's printed bold lines only", () => {
    const green = header({ rgba: paint([boldColumn], [31, 95, 58]) });
    const bold = line("United States", 246, 112, 180, true);

    expect(readInkColor(green, [blockPrinting(bold)])).toBe("#1f5f3a");
    expect(
      readInkColor(green, [blockPrinting({ ...bold, bold: false })]),
    ).toBeNull();
    expect(
      readInkColor(green, [blockPrinting({ ...bold, bold: null })]),
    ).toBeNull();
  });

  // A red wordmark (the name drawn as an image) right of the green column.
  const wordmark = box(600, 110, 400, 60);
  const wordmarkBlock = {
    role: "name" as const,
    lines: ["NATIONAL FOREST FOUNDATION"],
    box: box(596, 104, 410, 72),
    matched: [{ text: "NATIONAL FOREST FOUNDATION", printed: null }],
  };
  const greenAndRed = () => {
    const rgba = paint([boldColumn], [31, 95, 58]);
    const red = paint([wordmark], [200, 30, 30]);
    for (let p = 0; p < rgba.length; p += 4) {
      if (red[p] !== 255) {
        rgba.set(red.subarray(p, p + 4), p);
      }
    }
    return header({ rgba });
  };

  it("falls back to the model's boxes of name blocks nothing of which is printed", () => {
    const green = header({ rgba: paint([boldColumn], [31, 95, 58]) });
    // A scan's name lines, or a wordmark: no text layer under them.
    expect(readInkColor(green, [blockPrinting(null)])).toBe("#1f5f3a");
    expect(readInkColor(greenAndRed(), [wordmarkBlock])).toBe("#c81e1e");
    // Contact blocks are not the letterhead's accent.
    expect(
      readInkColor(green, [{ ...blockPrinting(null), role: "contact" }]),
    ).toBeNull();
    // A name block with a printed line is judged by its print only.
    expect(
      readInkColor(green, [
        {
          ...nameBlock,
          lines: ["United States", "Agency"],
          matched: [
            { text: "United States", printed: null },
            { text: "Agency", printed: line("Agency", 246, 112, 180, false) },
          ],
        },
      ]),
    ).toBeNull();
  });

  it("reads no colour from a wordmark, which the logo draws", () => {
    expect(
      readInkColor(greenAndRed(), [{ ...wordmarkBlock, wordmark: true }]),
    ).toBeNull();
    expect(
      readInkColor(greenAndRed(), [
        { ...wordmarkBlock, wordmark: true },
        blockPrinting(null),
      ]),
    ).toBe("#1f5f3a");
  });

  it("prefers the printed bold lines to a name block's model box", () => {
    const bold = line("United States", 246, 112, 180, true);
    expect(
      readInkColor(greenAndRed(), [blockPrinting(bold), wordmarkBlock]),
    ).toBe("#1f5f3a");
  });
});

describe("withBlockInk", () => {
  // Two caps lines, 14 rows of ink each: 20 px type by their cap height.
  const address = {
    role: "contact" as const,
    lines: ["BUILDING 27", "MISSOULA, MT"],
    box: box(1200, 110, 300, 60),
    matched: [
      { text: "BUILDING 27", printed: null },
      { text: "MISSOULA, MT", printed: null },
    ],
  };
  const printed = header({
    rgba: paint([box(1205, 115, 280, 14), box(1205, 145, 280, 14)]),
  });

  it("reads the font sizes and rows of a block nothing of which is printed from its ink", () => {
    const { ink } = withBlockInk(printed, address);
    expect(ink?.fontSizes).toHaveLength(2);
    expect(ink?.fontSizes[0]).toBeCloseTo(20, 9);
    expect(ink?.fontSizes[1]).toBeCloseTo(20, 9);
    // The rows its ink spans, tighter than the model's box (110–170).
    expect([ink?.top, ink?.bottom]).toEqual([115, 159]);
  });

  it("leaves a block with a printed line, or lines it cannot measure, as it is", () => {
    const partly = {
      ...address,
      matched: [
        {
          text: "BUILDING 27",
          printed: line("BUILDING 27", 1205, 115, 280, false),
        },
        { text: "MISSOULA, MT", printed: null },
      ],
    };
    expect(withBlockInk(printed, partly)).toBe(partly);
    // A blank header: no ink to read.
    expect(withBlockInk(header(), address)).toBe(address);
  });
});

describe("runLetterheadTask", () => {
  it("draws a wordmark into the logo beside it, keeping its lettering's pixel mark", async () => {
    // A scan-like header: a tree mark, the name in custom type beside it
    // (its two lines merge into one mark-shaped blob) and a typeset address.
    const tree = box(184, 95, 120, 170);
    const crops: Box[] = [];
    const { deps: taskDeps } = deps({
      renderHeader: async () =>
        header({
          rgba: paint([
            tree,
            box(320, 130, 160, 50),
            box(320, 186, 160, 50),
            box(1105, 140, 300, 12),
            box(1105, 166, 300, 12),
          ]),
          cropPng: (crop) => {
            crops.push(crop);
            return CROP;
          },
        }),
      readLetterhead: async () =>
        reading({
          blocks: [
            {
              role: "name",
              lines: ["National Forest", "Foundation"],
              wordmark: true,
              box: box(315, 125, 170, 115),
            },
            {
              role: "contact",
              lines: ["BUILDING 27", "MISSOULA, MT"],
              box: box(1100, 135, 310, 50),
            },
          ],
        }),
    });

    const result = await runLetterheadTask(URL, taskDeps);

    expect(result.ok).toBe(true);
    if (!result.ok || !result.analysis.grid) {
      return;
    }
    const { grid } = result.analysis;
    expect(grid.cells.map((cell) => [cell.kind, cell.valign])).toEqual([
      ["logo", undefined],
      ["text", "middle"],
    ]);
    // One crop holding the tree and the lettering.
    expect(crops).toHaveLength(1);
    expect(crops[0].x).toBeLessThan(tree.x);
    expect(crops[0].x + crops[0].width).toBeGreaterThan(480);
    expect(result.stats.logoSource).toBe("pixels");
  });

  it("sizes the lines of a letterhead drawn as an image by their ink", async () => {
    const { deps: taskDeps } = deps({
      renderHeader: async () =>
        header({
          rgba: paint([
            // A two-line mixed-case wordmark, 43 rows of ink a line.
            box(245, 105, 390, 43),
            box(245, 160, 390, 43),
            // Four caps lines: small caps (12 rows) and one full-caps line.
            box(1105, 105, 370, 12),
            box(1105, 131, 370, 12),
            box(1105, 157, 370, 15),
            box(1105, 183, 370, 12),
          ]),
        }),
      readLetterhead: async () =>
        reading({
          blocks: [
            {
              role: "name",
              lines: ["National Forest", "Foundation"],
              box: box(240, 100, 400, 110),
            },
            {
              role: "contact",
              lines: [
                "BUILDING 27, SUITE 3, FORT MISSOULA ROAD",
                "MISSOULA, MONTANA 59804",
                "TEL 406.542.2805",
                "NATIONALFORESTS.ORG",
              ],
              box: box(1100, 100, 380, 110),
            },
          ],
        }),
    });

    const result = await runLetterheadTask(URL, taskDeps);

    expect(result.ok).toBe(true);
    if (!result.ok || !result.analysis.grid) {
      return;
    }
    const { grid } = result.analysis;
    expect(
      grid.cells.map((cell) =>
        cell.kind === "text" ? cell.lines.map(({ size }) => size) : [],
      ),
    ).toEqual([
      ["xxlarge", "xxlarge"],
      ["normal", "normal", "normal", "normal"],
    ]);
    // Both columns' ink fills the row (rows 105–203 and 105–195): no
    // alignment of their own.
    expect(grid.cells.map((cell) => "valign" in cell)).toEqual([false, false]);
    // Font sizes 43 / 0.72 (twice), 12 / 0.7 (three times) and 15 / 0.7:
    // the median sits between the last two kinds.
    const median = (12 / 0.7 + 15 / 0.7) / 2;
    expect(grid.fontSize).toBeCloseTo(median / WIDTH, 5);
  });

  it("lays a digital letter out from the PDF's image draw and text", async () => {
    const { deps: taskDeps, calls } = deps({
      renderHeader: async () =>
        header({
          imageBoxes: [seal],
          rgba: paint([boldColumn], [31, 95, 58]),
          textItems: [
            line("United States", 246, 112, 140, true),
            line("1 Main St", 1400, 112, 100, false),
          ],
        }),
    });

    const result = await runLetterheadTask(URL, taskDeps);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.analysis.hasLetterhead).toBe(true);
    expect(result.analysis.grid?.color).toBe("#1f5f3a");
    expect(result.analysis.grid?.cells).toMatchObject([
      { kind: "logo", png: CROP },
      {
        kind: "text",
        align: "left",
        lines: [{ text: "United States", bold: true, size: "normal" }],
      },
      {
        kind: "text",
        align: "right",
        lines: [{ text: "1 Main St", bold: false, size: "normal" }],
      },
    ]);
    // The address cell ends the span.
    const [, , address] = result.analysis.grid?.cells ?? [];
    expect(address.x + address.width).toBeCloseTo(1, 9);
    expect(result.stats).toEqual({
      renderMs: 100,
      modelMs: 100,
      inputTokens: 1650,
      outputTokens: 240,
      logoSource: "pdf",
      logoCount: 1,
      lineCount: 2,
      printedLineCount: 2,
    });
    // The model sees the PNG and its size, nothing else.
    expect(calls.model).toEqual([{ png: PNG, width: WIDTH, height: HEIGHT }]);
  });

  it("moves the model's blocks onto the PDF's text, keeping columns apart", async () => {
    const { deps: taskDeps } = deps({
      renderHeader: async () =>
        header({
          imageBoxes: [seal],
          textItems: [
            line("United States", 246, 112, 140),
            line("Forest", 520, 112, 60),
            line("Service", 520, 137, 70),
            line("1 Main St", 1200, 112, 100),
          ],
        }),
      // "Forest Service" read over the USDA column: it would merge with it.
      readLetterhead: async () =>
        reading({
          blocks: [
            {
              role: "name",
              lines: ["United States"],
              box: box(240, 106, 200, 40),
            },
            {
              role: "name",
              lines: ["Forest", "Service"],
              box: box(300, 106, 150, 60),
            },
            {
              role: "contact",
              lines: ["1 Main St"],
              box: box(1190, 106, 150, 40),
            },
          ],
        }),
    });

    const result = await runLetterheadTask(URL, taskDeps);

    expect(kinds(result)).toEqual(["logo", "text", "text", "text"]);
    expect(
      result.ok &&
        result.analysis.grid?.cells.flatMap((cell) =>
          cell.kind === "text" ? [cell.lines.map(({ text }) => text)] : [],
        ),
    ).toEqual([["United States"], ["Forest", "Service"], ["1 Main St"]]);
  });

  it("keeps a placed image beside printed text, drops one printed text runs over", async () => {
    const run = (textX: number) =>
      runLetterheadTask(
        URL,
        deps({
          renderHeader: async () =>
            header({
              imageBoxes: [seal],
              textItems: [line("Agency", textX, 112, 300)],
            }),
          readLetterhead: async () =>
            reading({
              blocks: [
                { role: "name", lines: ["Agency"], box: box(60, 80, 400, 170) },
              ],
            }),
        }).deps,
      );

    // The model's loose box covers the seal, but the PDF prints the text
    // beside it: the image stays.
    const beside = await run(246);
    expect(kinds(beside)).toEqual(["logo", "text"]);
    expect(beside.stats).toMatchObject({ logoSource: "pdf", logoCount: 1 });

    // The PDF prints the name across the seal (a watermark under the text).
    const over = await run(60);
    expect(kinds(over)).toEqual(["text"]);
    expect(over.stats).toMatchObject({ logoSource: "none", logoCount: 0 });
  });

  it("reads a scan's OCR layer as unknown weight and keeps lines it does not print", async () => {
    const { deps: taskDeps } = deps({
      renderHeader: async () =>
        header({
          imageBoxes: [box(0, 0, PAGE.width, PAGE.height)],
          rgba: paint([seal]),
          // OCR text in an invisible font pdf.js still names "regular".
          textItems: [line("United States", 246, 112, 140, false)],
        }),
      readLetterhead: async () =>
        reading({
          blocks: [
            {
              role: "name",
              lines: ["United States", "Department of Agriculture"],
              box: box(240, 106, 200, 100),
            },
          ],
        }),
    });

    const result = await runLetterheadTask(URL, taskDeps);

    expect(
      result.ok &&
        result.analysis.grid?.cells.flatMap((cell) =>
          cell.kind === "text"
            ? cell.lines.map(({ text, bold }) => [text, bold])
            : [],
        ),
    ).toEqual([
      ["United States", true],
      ["Department of Agriculture", true],
    ]);
    expect(result.stats).toMatchObject({ lineCount: 2, printedLineCount: 1 });
  });

  it("leaves out a logo that cannot be cropped, keeping the letterhead", async () => {
    const { deps: taskDeps } = deps({
      renderHeader: async () =>
        header({
          imageBoxes: [seal],
          cropPng: () => {
            throw new Error("Logo box lies outside the rendered header");
          },
        }),
    });

    const result = await runLetterheadTask(URL, taskDeps);

    expect(kinds(result)).toEqual(["text", "text"]);
    expect(result.stats).toMatchObject({ logoCount: 0 });
  });

  it("drops scan marks that are the model's text, keeping the seal", async () => {
    const { deps: taskDeps } = deps({
      renderHeader: async () =>
        header({
          imageBoxes: [box(0, 0, PAGE.width, PAGE.height)],
          rgba: paint([seal, boldColumn]),
        }),
    });

    const result = await runLetterheadTask(URL, taskDeps);

    expect(kinds(result)).toEqual(["logo", "text", "text"]);
    expect(result.stats).toMatchObject({ logoSource: "pixels", logoCount: 1 });
    // A scan has no text layer: bold follows the block's role.
    expect(
      result.ok &&
        result.analysis.grid?.cells.flatMap((cell) =>
          cell.kind === "text" ? cell.lines.map(({ bold }) => bold) : [],
        ),
    ).toEqual([true, false]);
  });

  it("finds no logo when every scan mark is text", async () => {
    const { deps: taskDeps } = deps({
      renderHeader: async () =>
        header({
          imageBoxes: [box(0, 0, PAGE.width, PAGE.height)],
          rgba: paint([boldColumn]),
        }),
    });

    const result = await runLetterheadTask(URL, taskDeps);

    expect(kinds(result)).toEqual(["text", "text"]);
    expect(result.stats).toMatchObject({ logoSource: "none", logoCount: 0 });
  });

  it("stores no grid when the model finds no letterhead, or reads nothing", async () => {
    const notFound = await runLetterheadTask(
      URL,
      deps({
        readLetterhead: async () =>
          reading({ hasLetterhead: false, blocks: [] }),
      }).deps,
    );
    expect(notFound).toMatchObject({
      ok: true,
      analysis: { hasLetterhead: false, grid: null },
      stats: { logoSource: "none", logoCount: 0 },
    });

    const empty = await runLetterheadTask(
      URL,
      deps({
        renderHeader: async () => header(),
        readLetterhead: async () => reading({ blocks: [] }),
      }).deps,
    );
    expect(empty).toMatchObject({
      ok: true,
      analysis: { hasLetterhead: false, grid: null },
    });
  });

  it("fails a download without rendering or calling the model", async () => {
    const { deps: taskDeps, calls } = deps({
      download: async () => ({
        ok: false,
        reason: "fetch-failed",
        message: "Could not download the document.",
        detail: "HTTP 404",
      }),
    });

    const result = await runLetterheadTask(URL, taskDeps);

    expect(result).toMatchObject({
      ok: false,
      reason: "fetch-failed",
      detail: "HTTP 404",
    });
    expect(calls.render).toBe(0);
    expect(calls.model).toHaveLength(0);
  });

  it("fails a PDF that cannot be rendered without calling the model", async () => {
    const { deps: taskDeps, calls } = deps({
      renderHeader: async () => {
        throw new Error("Invalid PDF structure.");
      },
    });

    const result = await runLetterheadTask(URL, taskDeps);

    expect(result).toMatchObject({
      ok: false,
      reason: "unreadable",
      detail: "Invalid PDF structure.",
      stats: { renderMs: 100 },
    });
    expect(calls.model).toHaveLength(0);
  });

  it("fails an API error, and a request cut by the deadline as a timeout", async () => {
    const apiError = await runLetterheadTask(
      URL,
      deps({
        readLetterhead: async () => {
          throw new Error("529 overloaded");
        },
      }).deps,
    );
    expect(apiError).toMatchObject({
      ok: false,
      reason: "api-error",
      detail: "529 overloaded",
    });

    const deadline = new AbortController();
    const timedOut = await runLetterheadTask(
      URL,
      deps({
        signal: deadline.signal,
        readLetterhead: async () => {
          deadline.abort();
          throw new Error("Request was aborted.");
        },
      }).deps,
    );
    expect(timedOut).toMatchObject({ ok: false, reason: "timeout" });
  });

  it("fails an answer that is not the expected JSON, keeping the token counts", async () => {
    const { deps: taskDeps } = deps({
      readLetterhead: async () => ({
        ok: false,
        reason: "invalid-output",
        detail: "No JSON object in the answer (stop end_turn)",
        inputTokens: 1650,
        outputTokens: 12,
      }),
    });

    const result = await runLetterheadTask(URL, taskDeps);

    expect(result).toMatchObject({
      ok: false,
      reason: "invalid-output",
      stats: { inputTokens: 1650, outputTokens: 12 },
    });
  });
});
