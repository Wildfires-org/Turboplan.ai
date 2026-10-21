/**
 * Renders the top of a PDF's first page with pdf.js and `@napi-rs/canvas`,
 * recording where the PDF draws images (exact logo boxes for digital PDFs)
 * and reading where its text layer places text (exact column positions).
 *
 * Both libraries are loaded with `import()` by `loadHeaderRenderer`, so the
 * worker bundle never imports them statically: text extraction does not load
 * them (esbuild hoists static imports of external packages to the top of the
 * bundle).
 */

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Canvas, SKRSContext2D } from "@napi-rs/canvas";

import {
  type Box,
  LETTERHEAD_MAX_HEADER_HEIGHT,
  LETTERHEAD_RENDER_WIDTH,
  type PdfTextItem,
} from "@wildfires-org/turboplan-document-extraction/letterhead";

import type { RenderedHeader } from "./analysis-task";

/** The letterhead lives in the top of the page. */
const HEADER_RATIO = 0.3;

/**
 * Largest image pdf.js decodes, in pixels; a bigger one is left out of the
 * render. pdf.js decodes images at full size into native memory, outside the
 * worker's heap cap, at ~19 bytes a pixel while drawn (measured: a 600 dpi
 * Letter scan took ~740 MB), so one huge raster could take the whole machine
 * down. 12M pixels still fits a 300 dpi scan of a Letter (8.4M), A4 (8.7M) or
 * Legal (10.7M) page, at ~230 MB on top of the worker's own ~90 MB.
 */
export const PDF_MAX_IMAGE_PIXELS = 12_000_000;

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type CanvasModule = typeof import("@napi-rs/canvas");

/** The 2D transform `ctx.getTransform()` returns. */
type Transform = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

/**
 * The device-space box of one `drawImage` call: its destination rectangle
 * (3 arguments: the image's own size at dx, dy; 5: dx, dy, dw, dh; 9: the
 * last four) mapped through the current transform. pdf.js draws images in a
 * flipped unit square or at integer device coordinates, so only the
 * transform tells where an image lands.
 */
export const imageDrawBox = (
  args: unknown[],
  transform: Transform,
): Box | null => {
  let rect: number[];
  if (args.length >= 9) {
    rect = args.slice(5, 9) as number[];
  } else if (args.length >= 5) {
    rect = args.slice(1, 5) as number[];
  } else if (args.length >= 3) {
    const image = args[0] as { width: number; height: number };
    rect = [args[1] as number, args[2] as number, image.width, image.height];
  } else {
    return null;
  }

  const [x, y, width, height] = rect;
  const { a, b, c, d, e, f } = transform;
  const corners = [
    [x, y],
    [x + width, y],
    [x, y + height],
    [x + width, y + height],
  ].map(([px, py]) => [a * px + c * py + e, b * px + d * py + f]);
  const xs = corners.map(([cx]) => cx);
  const ys = corners.map(([, cy]) => cy);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    x: left,
    y: top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
  };
};

/** Wraps `ctx.drawImage` so every image drawn adds its device-space box. */
const recordImageDraws = (ctx: SKRSContext2D): Box[] => {
  const boxes: Box[] = [];
  const drawImage = ctx.drawImage.bind(ctx) as (...args: unknown[]) => void;
  ctx.drawImage = ((...args: unknown[]) => {
    const box = imageDrawBox(args, ctx.getTransform());
    if (box) {
      boxes.push(box);
    }
    drawImage(...args);
  }) as SKRSContext2D["drawImage"];
  return boxes;
};

type PageProxy = Awaited<
  ReturnType<
    Awaited<ReturnType<PdfjsModule["getDocument"]>["promise"]>["getPage"]
  >
>;
type PageViewport = ReturnType<PageProxy["getViewport"]>;

/** The invisible text fonts OCR tools lay over a scan carry no weight. */
const OCR_FONT_NAME = /glyphless/i;
/** Weight words in the style part of a name (after the family). */
const BOLD_STYLE = /black|heavy|demi|^(bd|blk|hvy|hv|xbd)/i;

/**
 * Whether a PostScript font name is a bold face: "bold" anywhere
 * ("ABCDEF+TimesNewRomanPS-BoldMT"); the other weight words only in the
 * style part after the family ("Futura-Demi", "HelveticaNeueLTStd-Bd"), so a
 * family like "BlackadderITC" is not bold. Null for an OCR text font, whose
 * weight says nothing about the scan under it.
 */
export const isBoldFontName = (name: string): boolean | null => {
  const bare = name.replace(/^[A-Z]{6}\+/, "");
  if (OCR_FONT_NAME.test(bare)) {
    return null;
  }
  if (/bold/i.test(bare)) {
    return true;
  }
  const style = bare.split(/[-,]/).slice(1).join("-");
  return BOLD_STYLE.test(style);
};

/**
 * Whether the font a text run uses is bold, from the font's own name on the
 * font object the render loaded into the page's common objects (exported only
 * with `fontExtraProperties`). Null when pdf.js has no name for it.
 */
const isBoldFont = (page: PageProxy, fontName: string): boolean | null => {
  try {
    const font = page.commonObjs.get(fontName) as { name?: unknown } | null;
    return typeof font?.name === "string" ? isBoldFontName(font.name) : null;
  } catch {
    return null;
  }
};

/**
 * The page's text runs that reach into the header, in the render's pixel
 * space: each run's baseline origin mapped through the viewport, its height
 * the font size, its width scaled from text space, bold from its font. A
 * scan has none.
 */
const readHeaderText = async (
  page: PageProxy,
  viewport: PageViewport,
  headerHeight: number,
  pdfjs: PdfjsModule,
): Promise<PdfTextItem[]> => {
  const { items } = await page.getTextContent();
  return items.flatMap((item) => {
    if (!("str" in item) || item.str.trim() === "") {
      return [];
    }
    const [, , c, d, e, f] = pdfjs.Util.transform(
      viewport.transform,
      item.transform,
    );
    const fontHeight = Math.hypot(c, d);
    const box = {
      x: e,
      y: f - fontHeight,
      width: item.width * viewport.scale,
      height: fontHeight,
    };
    if (box.y >= headerHeight) {
      return [];
    }
    return [{ text: item.str, box, bold: isBoldFont(page, item.fontName) }];
  });
};

/**
 * A PNG of part of the rendered header: the box rounded out to whole pixels
 * and clipped to the canvas.
 */
const cropHeader = (
  canvas: Canvas,
  { createCanvas }: CanvasModule,
  box: Box,
): Uint8Array => {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const width = Math.min(canvas.width, Math.ceil(box.x + box.width)) - x;
  const height = Math.min(canvas.height, Math.ceil(box.y + box.height)) - y;
  if (width <= 0 || height <= 0) {
    throw new Error("Logo box lies outside the rendered header");
  }
  const crop = createCanvas(width, height);
  crop
    .getContext("2d")
    .drawImage(canvas, x, y, width, height, 0, 0, width, height);
  return crop.toBuffer("image/png");
};

/**
 * pdf.js data files (standard fonts for unembedded fonts, CMaps for CJK text,
 * wasm image decoders for JPEG 2000 / JBIG2 scans, ICC profiles), resolved
 * from wherever the package is installed: the workspace in dev and tests,
 * `node_modules` next to `dist/` in the Fly image.
 */
const pdfjsDataUrls = () => {
  const root = dirname(
    createRequire(import.meta.url).resolve("pdfjs-dist/package.json"),
  );
  return {
    standardFontDataUrl: `${join(root, "standard_fonts")}/`,
    cMapUrl: `${join(root, "cmaps")}/`,
    wasmUrl: `${join(root, "wasm")}/`,
    iccUrl: `${join(root, "iccs")}/`,
  };
};

const renderHeader = async (
  bytes: Uint8Array,
  pdfjs: PdfjsModule,
  canvasModule: CanvasModule,
): Promise<RenderedHeader> => {
  const { createCanvas } = canvasModule;
  const loadingTask = pdfjs.getDocument({
    // pdf.js refuses a Node Buffer (what the download returns): hand it a
    // plain view of the same bytes.
    data: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    ...pdfjsDataUrls(),
    // Keeps each font's name on the loaded font object (bold detection).
    fontExtraProperties: true,
    maxImageSize: PDF_MAX_IMAGE_PIXELS,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  try {
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const unscaled = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: LETTERHEAD_RENDER_WIDTH / unscaled.width,
    });
    const width = Math.round(viewport.width);
    const pageHeight = Math.round(viewport.height);
    const height = Math.min(
      Math.round(pageHeight * HEADER_RATIO),
      LETTERHEAD_MAX_HEADER_HEIGHT,
    );

    // The canvas is only the header: whatever the page draws below it is
    // clipped, and image boxes keep page coordinates (origin top-left).
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    // White paper: transparent pixels would read as ink to the mark finder.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    const imageBoxes = recordImageDraws(ctx);
    // `canvas: null` makes pdf.js draw on this context (and its wrapper)
    // instead of asking the canvas for a context of its own.
    await page.render({
      canvas: null,
      canvasContext: ctx,
      viewport,
    }).promise;

    return {
      png: canvas.toBuffer("image/png"),
      rgba: ctx.getImageData(0, 0, width, height).data,
      width,
      height,
      page: { width, height: pageHeight },
      imageBoxes: imageBoxes.filter((box) => box.y < height),
      textItems: await readHeaderText(page, viewport, height, pdfjs),
      // Keeps the header canvas alive for as long as the result is.
      cropPng: (box) => cropHeader(canvas, canvasModule, box),
    };
  } finally {
    await loadingTask.destroy();
  }
};

/** Loads pdf.js and the canvas once; the returned function renders a PDF. */
export const loadHeaderRenderer = async (): Promise<
  (bytes: Uint8Array) => Promise<RenderedHeader>
> => {
  const [pdfjs, canvas] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("@napi-rs/canvas"),
  ]);
  return (bytes) => renderHeader(bytes, pdfjs, canvas);
};
