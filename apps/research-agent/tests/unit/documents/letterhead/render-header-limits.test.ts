import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

// The real pdf.js, with every getDocument call's parameters recorded.
const getDocumentCalls = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", async (importOriginal) => {
  const pdfjs =
    await importOriginal<typeof import("pdfjs-dist/legacy/build/pdf.mjs")>();
  return {
    ...pdfjs,
    getDocument: (params: Parameters<typeof pdfjs.getDocument>[0]) => {
      getDocumentCalls.push(params as Record<string, unknown>);
      return pdfjs.getDocument(params);
    },
  };
});

import {
  loadHeaderRenderer,
  PDF_MAX_IMAGE_PIXELS,
} from "../../../../src/documents/letterhead/render-header";

// A 300 dpi scan of a Letter page, the largest common scan.
const LETTER_SCAN_300_DPI_PIXELS = 2550 * 3300;

describe("renderHeader's pdf.js limits", () => {
  it("opens the PDF with maxImageSize, which a 300 dpi Letter scan fits", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const render = await loadHeaderRenderer();

    await render(await doc.save());

    expect(getDocumentCalls).toHaveLength(1);
    expect(getDocumentCalls[0].maxImageSize).toBe(PDF_MAX_IMAGE_PIXELS);
    expect(PDF_MAX_IMAGE_PIXELS).toBeGreaterThan(LETTER_SCAN_300_DPI_PIXELS);
  });
});
