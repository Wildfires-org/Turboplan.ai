import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decodeLetterheadImage,
  getModelVisibleSize,
  letterheadExtractRequestSchema,
  MAX_LETTERHEAD_IMAGE_BYTES,
  normalizeHexColor,
  normalizeLetterheadExtraction,
  readJpegSize,
  readPngSize,
} from "../src/utils/letterhead-extract.js";

// Signature + IHDR chunk (length, "IHDR", width 1530, height 495).
const PNG_HEADER = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44,
  0x52, 0, 0, 0x05, 0xfa, 0, 0, 0x01, 0xef, 8, 6, 0, 0, 0,
];
// SOI, an APP0 segment (length 4), then SOF0 with height 248 / width 765.
const JPEG_HEADER = [
  0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 0xf8, 0x02, 0xfd,
  3, 1, 0x22, 0,
];
const toBase64 = (bytes: number[]) => Buffer.from(bytes).toString("base64");

const ORG_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

describe("letterheadExtractRequestSchema", () => {
  it("accepts an org-scoped request", () => {
    const parsed = letterheadExtractRequestSchema.safeParse({
      organizationId: ORG_ID,
      image: "abcd",
      mimeType: "image/png",
    });
    assert.equal(parsed.success, true);
  });

  it("rejects other mime types, non-uuid ids and a missing image", () => {
    const base = {
      organizationId: ORG_ID,
      image: "abcd",
      mimeType: "image/png",
    };
    for (const body of [
      { ...base, mimeType: "image/gif" },
      { ...base, organizationId: "nope" },
      { ...base, officeId: "nope" },
      { ...base, image: "" },
    ]) {
      assert.equal(
        letterheadExtractRequestSchema.safeParse(body).success,
        false,
      );
    }
  });
});

describe("decodeLetterheadImage", () => {
  it("decodes a PNG and a JPEG and reads their size", () => {
    const png = decodeLetterheadImage(toBase64(PNG_HEADER), "image/png");
    assert.deepEqual(png.ok && png.size, { width: 1530, height: 495 });
    const jpeg = decodeLetterheadImage(toBase64(JPEG_HEADER), "image/jpeg");
    assert.deepEqual(jpeg.ok && jpeg.size, { width: 765, height: 248 });
  });

  it("rejects a truncated image whose size can't be read", () => {
    const result = decodeLetterheadImage(
      toBase64(PNG_HEADER.slice(0, 12)),
      "image/png",
    );
    assert.equal(!result.ok && result.error, "Unreadable image");
    assert.equal(readJpegSize(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), null);
    assert.equal(readPngSize(new Uint8Array(30)), null);
  });

  it("rejects bytes that don't match the declared type", () => {
    const result = decodeLetterheadImage(toBase64(PNG_HEADER), "image/jpeg");
    assert.deepEqual(result, {
      ok: false,
      status: 400,
      error: "Image does not match mimeType",
    });
  });

  it("rejects malformed base64 and data URLs", () => {
    for (const image of [
      "not base64!",
      "data:image/png;base64,iVBORw0KGgo=",
      "a",
    ]) {
      const result = decodeLetterheadImage(image, "image/png");
      assert.equal(result.ok, false);
      assert.equal(!result.ok && result.status, 400);
    }
  });

  it("rejects images over the size cap with 413", () => {
    const oversized = Buffer.alloc(MAX_LETTERHEAD_IMAGE_BYTES + 3);
    oversized.set(PNG_HEADER);
    const result = decodeLetterheadImage(
      oversized.toString("base64"),
      "image/png",
    );
    assert.equal(!result.ok && result.status, 413);
  });
});

describe("normalizeHexColor", () => {
  it("normalizes valid colors and rejects the rest", () => {
    assert.equal(normalizeHexColor("#2E7D32"), "#2e7d32");
    assert.equal(normalizeHexColor("2e7d32"), "#2e7d32");
    assert.equal(normalizeHexColor("#abc"), "#aabbcc");
    assert.equal(normalizeHexColor("green"), null);
    assert.equal(normalizeHexColor("#12345"), null);
    assert.equal(normalizeHexColor(null), null);
  });
});

// A 1000x500 image keeps the pixel → fraction arithmetic readable.
const SIZE = { width: 1000, height: 500 };

describe("normalizeLetterheadExtraction", () => {
  it("trims, drops empties and caps line lists", () => {
    const result = normalizeLetterheadExtraction(
      {
        layout: "columns",
        nameLines: [
          "  U.S. Department  of Agriculture ",
          "",
          "  ",
          "A",
          "B",
          "C",
          "D",
          "E",
        ],
        contactLines: ["Building 12", "", "1", "2", "3", "4", "5", "6"],
        color: null,
        logoBox: null,
        headerBottom: 600,
      },
      SIZE,
    );
    assert.deepEqual(result.nameLines, [
      "U.S. Department of Agriculture",
      "A",
      "B",
      "C",
      "D",
    ]);
    assert.equal(result.contactLines.length, 6);
    assert.equal(result.contactLines[0], "Building 12");
  });

  it("converts pixel geometry to fractions of the image", () => {
    const result = normalizeLetterheadExtraction(
      {
        layout: "split",
        nameLines: ["Pine Valley Conservancy"],
        contactLines: [],
        color: "#1A5F7A",
        logoBox: { x: 120, y: 100, width: 80, height: 170 },
        headerBottom: 290,
      },
      SIZE,
    );
    assert.deepEqual(result.logoBox, {
      x: 0.12,
      y: 0.2,
      width: 0.08,
      height: 0.34,
    });
    assert.equal(result.headerBottom, 0.58);
    assert.equal(result.color, "#1a5f7a");
  });

  it("clamps the logo box into the image and keeps the logo above headerBottom", () => {
    const result = normalizeLetterheadExtraction(
      {
        layout: "split",
        nameLines: [],
        contactLines: [],
        color: null,
        logoBox: { x: -100, y: 100, width: 400, height: 750 },
        headerBottom: 200,
      },
      SIZE,
    );
    assert.deepEqual(result.logoBox, { x: 0, y: 0.2, width: 0.3, height: 0.8 });
    assert.equal(result.headerBottom, 1);
  });

  it("clamps headerBottom past the image to 1", () => {
    const result = normalizeLetterheadExtraction(
      { layout: "centered", logoBox: null, headerBottom: 900 },
      SIZE,
    );
    assert.equal(result.headerBottom, 1);
  });

  it("drops degenerate boxes and defaults bad values", () => {
    const result = normalizeLetterheadExtraction(
      {
        layout: "diagonal" as never,
        nameLines: undefined,
        contactLines: [42 as never, "TEL 555.555.0100"],
        color: "teal",
        logoBox: { x: 1200, y: 10, width: 200, height: 200 },
        headerBottom: Number.NaN,
      },
      SIZE,
    );
    assert.equal(result.layout, "split");
    assert.deepEqual(result.nameLines, []);
    assert.deepEqual(result.contactLines, ["TEL 555.555.0100"]);
    assert.equal(result.color, null);
    assert.equal(result.logoBox, null);
    assert.equal(result.headerBottom, 1);
  });
});

describe("getModelVisibleSize", () => {
  it("keeps images the provider won't resize", () => {
    assert.deepEqual(getModelVisibleSize({ width: 1530, height: 495 }), {
      width: 1530,
      height: 495,
    });
  });

  it("caps the long edge and the area like the provider does", () => {
    assert.deepEqual(getModelVisibleSize({ width: 2448, height: 792 }), {
      width: 1568,
      height: 507,
    });
    const square = getModelVisibleSize({ width: 2000, height: 2000 });
    assert.equal(square.width, square.height);
    assert.ok(square.width * square.height <= 1_150_000);
  });
});
