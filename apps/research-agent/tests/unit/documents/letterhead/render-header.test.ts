import { createCanvas } from "@napi-rs/canvas";
import {
  concatTransformationMatrix,
  drawObject,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";

import { toTextLines } from "@wildfires-org/turboplan-document-extraction/letterhead";

import {
  locateLogos,
  type RenderedHeader,
} from "../../../../src/documents/letterhead/analysis-task";
import {
  imageDrawBox,
  isBoldFontName,
  loadHeaderRenderer,
  PDF_MAX_IMAGE_PIXELS,
} from "../../../../src/documents/letterhead/render-header";

// Letter page in points, rendered 1568 px wide.
const PAGE_WIDTH_PT = 612;
const PAGE_HEIGHT_PT = 792;
const SCALE = 1568 / PAGE_WIDTH_PT;
// The seal: 56 pt square, 28 pt from the left, its top 36 pt from the top.
const SEAL_PT = { x: 28, top: 36, size: 56 };

/** A round emblem with a white triangle, like an agency seal. */
const emblemPng = (): Buffer => {
  const canvas = createCanvas(240, 240);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1f5f3a";
  ctx.beginPath();
  ctx.arc(120, 120, 115, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(120, 30);
  ctx.lineTo(190, 170);
  ctx.lineTo(50, 170);
  ctx.closePath();
  ctx.fill();
  return canvas.toBuffer("image/png");
};

/**
 * A digital agency letter: the seal in the left margin, three bold name
 * columns, a right-aligned address column and a rule (the "columns" layout).
 */
const agencyLetter = async (): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  page.drawImage(await doc.embedPng(emblemPng()), {
    x: SEAL_PT.x,
    y: PAGE_HEIGHT_PT - SEAL_PT.top - SEAL_PT.size,
    width: SEAL_PT.size,
    height: SEAL_PT.size,
  });

  const top = 740;
  const columns = [
    ["United States", "Department of", "Agriculture"],
    ["Forest", "Service"],
    ["Shoshone", "National Forest"],
  ];
  columns.forEach((lines, index) => {
    lines.forEach((line, row) => {
      page.drawText(line, {
        x: 96 + index * 110,
        y: top - row * 12,
        size: 10,
        font: bold,
        color: rgb(0.12, 0.37, 0.23),
      });
    });
  });
  [
    "Wind River Ranger District",
    "1403 W. Ramshorn",
    "Dubois, WY 82513",
  ].forEach((line, row) => {
    const width = regular.widthOfTextAtSize(line, 9);
    page.drawText(line, {
      x: 584 - width,
      y: top - row * 11,
      size: 9,
      font: regular,
    });
  });
  page.drawLine({
    start: { x: 96, y: 690 },
    end: { x: 584, y: 690 },
    thickness: 1,
  });
  page.drawText("Dear Interested Party:", {
    x: 96,
    y: 600,
    size: 11,
    font: regular,
  });
  return doc.save();
};

/** The same seal on a copier scan: one page-sized image. */
const scannedLetter = async (): Promise<Uint8Array> => {
  const scale = 2;
  const canvas = createCanvas(PAGE_WIDTH_PT * scale, PAGE_HEIGHT_PT * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const { loadImage } = await import("@napi-rs/canvas");
  ctx.drawImage(
    await loadImage(emblemPng()),
    SEAL_PT.x * scale,
    SEAL_PT.top * scale,
    SEAL_PT.size * scale,
    SEAL_PT.size * scale,
  );

  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
  page.drawImage(await doc.embedPng(canvas.toBuffer("image/png")), {
    x: 0,
    y: 0,
    width: PAGE_WIDTH_PT,
    height: PAGE_HEIGHT_PT,
  });
  return doc.save();
};

/** The seal's box in rendered pixels, within `tolerance` px per edge. */
const expectSealBox = (
  box: { x: number; y: number; width: number; height: number },
  tolerance: number,
) => {
  const expected = [
    SEAL_PT.x * SCALE,
    SEAL_PT.top * SCALE,
    SEAL_PT.size * SCALE,
    SEAL_PT.size * SCALE,
  ];
  [box.x, box.y, box.width, box.height].forEach((value, index) => {
    expect(Math.abs(value - expected[index])).toBeLessThanOrEqual(tolerance);
  });
};

/**
 * Two gray images side by side in the header, both 56 pt square on the page:
 * a 200 px one, and one just over `PDF_MAX_IMAGE_PIXELS` that carries all its
 * pixel data, so only its size can keep pdf.js from drawing it.
 */
const letterWithOversizedImage = async (): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
  const grayImage = (width: number, height: number) =>
    page.node.newXObject(
      "Image",
      doc.context.register(
        doc.context.flateStream(new Uint8Array(width * height).fill(96), {
          Type: "XObject",
          Subtype: "Image",
          Width: width,
          Height: height,
          ColorSpace: "DeviceGray",
          BitsPerComponent: 8,
        }),
      ),
    );
  const small = grayImage(200, 200);
  const oversized = grayImage(4000, PDF_MAX_IMAGE_PIXELS / 4000 + 1);
  for (const [image, x] of [
    [small, SEAL_PT.x],
    [oversized, 300],
  ] as const) {
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(
        SEAL_PT.size,
        0,
        0,
        SEAL_PT.size,
        x,
        PAGE_HEIGHT_PT - SEAL_PT.top - SEAL_PT.size,
      ),
      drawObject(image),
      popGraphicsState(),
    );
  }
  return doc.save();
};

describe("loadHeaderRenderer (real pdf.js + canvas)", () => {
  let render: (bytes: Uint8Array) => Promise<RenderedHeader>;

  beforeAll(async () => {
    render = await loadHeaderRenderer();
  });

  it("renders the top 30 % of page 1 at 1568 px, as PNG and RGBA", async () => {
    const header = await render(await agencyLetter());

    expect(header.width).toBe(1568);
    expect(header.page).toEqual({ width: 1568, height: 2029 });
    expect(header.height).toBe(609);
    expect([...header.png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(header.rgba).toHaveLength(1568 * 609 * 4);
  });

  it("reads the header crop's text layer, side-by-side columns as separate lines", async () => {
    const header = await render(await agencyLetter());
    const lines = toTextLines(header.textItems);

    expect(lines.map(({ text }) => text)).toEqual([
      "United States",
      "Forest",
      "Shoshone",
      "Wind River Ranger District",
      "Department of",
      "Service",
      "National Forest",
      "1403 W. Ramshorn",
      "Agriculture",
      "Dubois, WY 82513",
      // Inside the top 30 %; the model leaves it out of the letterhead.
      "Dear Interested Party:",
    ]);
    // "Forest" is drawn at x 206 pt, baseline 740 pt, 10 pt bold.
    const forest = lines[1].box;
    expect(forest.x).toBeCloseTo(206 * SCALE, 0);
    expect(forest.y).toBeCloseTo((PAGE_HEIGHT_PT - 740 - 10) * SCALE, 0);
    expect(forest.height).toBeCloseTo(10 * SCALE, 0);
  });

  it("tells bold text from regular by the font's name", async () => {
    const header = await render(await agencyLetter());
    const lines = toTextLines(header.textItems);

    expect(lines[1]).toMatchObject({ text: "Forest", bold: true });
    expect(lines[3]).toMatchObject({
      text: "Wind River Ranger District",
      bold: false,
    });
  });

  it("has no text layer for a scan", async () => {
    const header = await render(await scannedLetter());

    expect(header.textItems).toEqual([]);
  });

  it("crops a PNG of a box of the header, clipped to the render", async () => {
    const header = await render(await agencyLetter());
    const [sealBox] = header.imageBoxes;

    const png = header.cropPng(sealBox);
    const { loadImage } = await import("@napi-rs/canvas");
    const image = await loadImage(Buffer.from(png));
    expect(image.width).toBeGreaterThanOrEqual(Math.floor(sealBox.width));
    expect(image.width).toBeLessThanOrEqual(Math.ceil(sealBox.width) + 1);
    expect(image.height).toBeGreaterThanOrEqual(Math.floor(sealBox.height));

    // A box running off the bottom is cut at the header's edge.
    const clipped = await loadImage(
      Buffer.from(
        header.cropPng({ x: 0, y: header.height - 10, width: 50, height: 100 }),
      ),
    );
    expect(clipped.height).toBe(10);
    expect(() =>
      header.cropPng({ x: 0, y: header.height + 5, width: 50, height: 10 }),
    ).toThrow();
  });

  it("finds a digital letter's seal from the PDF's image draw, not the pixels", async () => {
    const header = await render(await agencyLetter());

    // Exact: where pdf.js draws the image.
    expect(header.imageBoxes).toHaveLength(1);
    expectSealBox(header.imageBoxes[0], 1);

    const logos = locateLogos(header);
    expect(logos.source).toBe("pdf");
    expect(logos.boxes).toEqual(header.imageBoxes);
  });

  it("finds a scanned letter's seal in the pixels", async () => {
    const header = await render(await scannedLetter());

    // The page image is drawn, but it is no logo.
    expect(header.imageBoxes).toHaveLength(1);
    expect(header.imageBoxes[0]).toMatchObject({ x: 0, y: 0, width: 1568 });

    const logos = locateLogos(header);
    expect(logos.source).toBe("pixels");
    expect(logos.boxes).toHaveLength(1);
    // The ink, not the image square: the round emblem sits ~3 px inside its
    // square, and pixels are sampled every second pixel.
    expectSealBox(logos.boxes[0], 8);
  });

  it("takes the Buffer the download returns", async () => {
    const header = await render(Buffer.from(await agencyLetter()));

    expect(locateLogos(header).source).toBe("pdf");
  });

  it("leaves out an image over PDF_MAX_IMAGE_PIXELS without decoding it", async () => {
    const header = await render(await letterWithOversizedImage());

    expect(header.imageBoxes).toHaveLength(1);
    expect(header.imageBoxes[0].x).toBeCloseTo(SEAL_PT.x * SCALE, 0);
  });

  it("rejects bytes that are not a PDF", async () => {
    await expect(
      render(new TextEncoder().encode("<html>not a pdf</html>")),
    ).rejects.toThrow();
  });
});

describe("imageDrawBox", () => {
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const image = { width: 40, height: 30 };

  it("uses the image's own size for drawImage(image, dx, dy)", () => {
    expect(imageDrawBox([image, 10, 20], { ...identity, e: 5, f: 7 })).toEqual({
      x: 15,
      y: 27,
      width: 40,
      height: 30,
    });
  });

  it("uses the destination size for drawImage(image, dx, dy, dw, dh)", () => {
    expect(
      imageDrawBox([image, 10, 20, 100, 50], { ...identity, a: 2, d: 2 }),
    ).toEqual({ x: 20, y: 40, width: 200, height: 100 });
  });

  it("uses the last four of drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)", () => {
    // pdf.js paints an image into a unit square flipped vertically.
    const flipped = { a: 143, b: 0, c: 0, d: -143, e: 72, f: 235 };
    expect(imageDrawBox([image, 0, 0, 40, 30, 0, 0, 1, 1], flipped)).toEqual({
      x: 72,
      y: 92,
      width: 143,
      height: 143,
    });
  });

  it("ignores a call without a destination", () => {
    expect(imageDrawBox([image], identity)).toBeNull();
  });
});

describe("isBoldFontName", () => {
  it.each([
    ["ABCDEF+TimesNewRomanPS-BoldMT", true],
    ["Helvetica-Bold", true],
    ["Arial,BoldItalic", true],
    ["Futura-Demi", true],
    ["HelveticaNeueLTStd-Bd", true],
    ["HelveticaNeueLTStd-BdIt", true],
    ["Avenir-Black", true],
    ["Helvetica-Heavy", true],
    ["Helvetica", false],
    ["TimesNewRomanPSMT", false],
    ["BlackadderITC-Regular", false],
    ["Arial-ItalicMT", false],
    ["GlyphLessFont", null],
    ["ABCDEF+GlyphLessFont", null],
  ])("%s → %s", (name, expected) => {
    expect(isBoldFontName(name)).toBe(expected);
  });
});
