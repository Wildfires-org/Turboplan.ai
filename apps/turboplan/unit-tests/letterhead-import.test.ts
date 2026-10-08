import assert from "node:assert";
import { describe, it } from "node:test";

import {
  bytesToBase64,
  expandRect,
  findInkBounds,
  fitWithin,
  getBannerRect,
  getExtractErrorMessage,
  getHeaderRegionRect,
  getPaddedBoxRect,
  getRenderScale,
  hasExtractedText,
  isSupportedImportType,
  isUsableBox,
  type LetterheadExtractResult,
  toTextLetterheadValues,
} from "../lib/letterhead-import";

const HEADER = { width: 1700, height: 660 };

const RESULT: LetterheadExtractResult = {
  layout: "split",
  nameLines: ["Pine Valley Conservancy"],
  contactLines: ["200 Ridge Road", "Bend, OR 97701"],
  color: "#1F5F3A",
  logoBox: { x: 0.05, y: 0.1, width: 0.2, height: 0.3 },
  headerBottom: 0.5,
};

describe("getRenderScale", () => {
  it("scales a US Letter page (612pt) to the target width", () => {
    assert.strictEqual(getRenderScale(612, 1700) * 612, 1700);
  });

  it("falls back to 1 for a zero-width page", () => {
    assert.strictEqual(getRenderScale(0), 1);
  });
});

describe("getHeaderRegionRect", () => {
  it("takes the top 30% of the page by default", () => {
    assert.deepStrictEqual(getHeaderRegionRect({ width: 1700, height: 2200 }), {
      x: 0,
      y: 0,
      width: 1700,
      height: 660,
    });
  });
});

describe("getPaddedBoxRect", () => {
  it("converts to pixels and pads evenly by 4% of the larger side", () => {
    // Box: 340×198 px at (85, 66); larger side 340 → 13.6 px padding.
    assert.deepStrictEqual(getPaddedBoxRect(RESULT.logoBox!, HEADER), {
      x: 71,
      y: 52,
      width: 368,
      height: 226,
    });
  });

  it("clamps to the image edges", () => {
    const rect = getPaddedBoxRect(
      { x: 0, y: 0, width: 1, height: 1 },
      HEADER,
      0.1,
    );
    assert.deepStrictEqual(rect, { x: 0, y: 0, width: 1700, height: 660 });
  });

  it("never returns an empty rect", () => {
    const rect = getPaddedBoxRect(
      { x: 0.999, y: 0.999, width: 0, height: 0 },
      HEADER,
      0,
    );
    assert.ok(rect.width >= 1 && rect.height >= 1);
    assert.ok(rect.x + rect.width <= HEADER.width);
    assert.ok(rect.y + rect.height <= HEADER.height);
  });
});

describe("getBannerRect", () => {
  it("spans the full width down to the header bottom plus 2%", () => {
    assert.deepStrictEqual(getBannerRect(0.5, HEADER), {
      x: 0,
      y: 0,
      width: 1700,
      height: Math.ceil(0.52 * 660),
    });
  });

  it("uses the whole header when the bottom is unknown or past the end", () => {
    assert.strictEqual(getBannerRect(0, HEADER).height, 660);
    assert.strictEqual(getBannerRect(0.99, HEADER).height, 660);
  });
});

describe("bytesToBase64", () => {
  it("matches Buffer's encoding, without a data: prefix", () => {
    const bytes = new Uint8Array(100_000).map((_, index) => index % 256);
    assert.strictEqual(
      bytesToBase64(bytes),
      Buffer.from(bytes).toString("base64"),
    );
  });

  it("encodes an empty array", () => {
    assert.strictEqual(bytesToBase64(new Uint8Array()), "");
  });
});

describe("isUsableBox", () => {
  it("accepts a box with area inside the image", () => {
    assert.ok(isUsableBox(RESULT.logoBox));
  });

  it("rejects null, empty and out-of-range boxes", () => {
    assert.ok(!isUsableBox(null));
    assert.ok(!isUsableBox({ x: 0.1, y: 0.1, width: 0, height: 0.2 }));
    assert.ok(!isUsableBox({ x: 1.2, y: 0.1, width: 0.1, height: 0.2 }));
    assert.ok(!isUsableBox({ x: Number.NaN, y: 0, width: 0.1, height: 0.1 }));
  });
});

describe("toTextLetterheadValues", () => {
  it("joins lines and normalizes the color", () => {
    assert.deepStrictEqual(toTextLetterheadValues(RESULT), {
      layout: "split",
      lines: "Pine Valley Conservancy",
      contact: "200 Ridge Road\nBend, OR 97701",
      color: "#1f5f3a",
    });
  });

  it("drops a color that isn't #rrggbb", () => {
    assert.strictEqual(
      toTextLetterheadValues({ ...RESULT, color: "green" }).color,
      "",
    );
    assert.strictEqual(
      toTextLetterheadValues({ ...RESULT, color: null }).color,
      "",
    );
  });
});

describe("hasExtractedText", () => {
  it("is false when nothing was read", () => {
    assert.ok(hasExtractedText(RESULT));
    assert.ok(
      !hasExtractedText({ ...RESULT, nameLines: [], contactLines: [] }),
    );
  });
});

describe("isSupportedImportType", () => {
  it("accepts PDF, PNG and JPEG only", () => {
    assert.ok(isSupportedImportType("application/pdf"));
    assert.ok(isSupportedImportType("image/png"));
    assert.ok(isSupportedImportType("image/jpeg"));
    assert.ok(!isSupportedImportType("image/gif"));
    assert.ok(!isSupportedImportType(""));
  });
});

describe("getExtractErrorMessage", () => {
  it("explains permission and rate limit errors", () => {
    assert.match(getExtractErrorMessage(403), /permission/);
    assert.match(getExtractErrorMessage(429), /try again/i);
    assert.match(getExtractErrorMessage(402), /credits/);
    assert.match(getExtractErrorMessage(504), /too long/);
    assert.match(getExtractErrorMessage(null), /couldn't read/);
  });
});

describe("fitWithin", () => {
  it("scales the long edge down to the limit", () => {
    assert.deepStrictEqual(fitWithin({ width: 1700, height: 660 }, 1568), {
      width: 1568,
      height: 609,
    });
  });

  it("never upscales", () => {
    assert.deepStrictEqual(fitWithin({ width: 800, height: 300 }, 1568), {
      width: 800,
      height: 300,
    });
  });
});

describe("findInkBounds", () => {
  // 6×4 white RGBA image with ink at the given pixels.
  const image = (ink: Array<[number, number]>) => {
    const size = { width: 6, height: 4 };
    const data = new Uint8ClampedArray(6 * 4 * 4).fill(255);
    for (const [x, y] of ink) {
      data.set([20, 60, 40, 255], (y * 6 + x) * 4);
    }
    return { data, size };
  };

  it("bounds the non-white pixels", () => {
    const { data, size } = image([
      [1, 1],
      [3, 2],
    ]);
    assert.deepStrictEqual(findInkBounds(data, size), {
      x: 1,
      y: 1,
      width: 3,
      height: 2,
    });
  });

  it("treats transparent pixels as paper and returns null when blank", () => {
    const { data, size } = image([]);
    data.set([0, 0, 0, 0], 0);
    assert.strictEqual(findInkBounds(data, size), null);
  });
});

describe("expandRect", () => {
  it("adds a margin clamped to the image", () => {
    assert.deepStrictEqual(
      expandRect({ x: 1, y: 1, width: 3, height: 2 }, 2, {
        width: 6,
        height: 4,
      }),
      { x: 0, y: 0, width: 6, height: 4 },
    );
  });
});
