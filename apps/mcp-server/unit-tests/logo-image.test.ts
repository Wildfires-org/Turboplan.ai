import assert from "node:assert";
import { describe, it } from "node:test";

import {
  detectSvg,
  resolveLogoImageType,
  sniffLogoImageType,
} from "../src/utils/logo-image.js";

const bytes = (text: string) => new TextEncoder().encode(text);

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
// 0xC3 starts a two-byte UTF-8 sequence; 0x28 is not a valid continuation.
const INVALID_UTF8_BYTES = new Uint8Array([0xc3, 0x28]);

const SAFE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>`;

describe("sniffLogoImageType", () => {
  it("detects PNG magic bytes", () => {
    assert.deepStrictEqual(sniffLogoImageType(PNG_BYTES), {
      mime: "image/png",
      extension: "png",
    });
  });

  it("detects JPEG magic bytes", () => {
    assert.deepStrictEqual(sniffLogoImageType(JPEG_BYTES), {
      mime: "image/jpeg",
      extension: "jpg",
    });
  });

  it("detects WebP magic bytes", () => {
    assert.deepStrictEqual(sniffLogoImageType(WEBP_BYTES), {
      mime: "image/webp",
      extension: "webp",
    });
  });

  it("returns null for unknown bytes", () => {
    assert.strictEqual(sniffLogoImageType(bytes("not an image")), null);
  });

  it("returns null for truncated magic bytes", () => {
    assert.strictEqual(sniffLogoImageType(PNG_BYTES.slice(0, 4)), null);
  });

  it("does not trust an SVG payload as a binary type", () => {
    assert.strictEqual(sniffLogoImageType(bytes(SAFE_SVG)), null);
  });
});

describe("detectSvg — root detection", () => {
  it("accepts a plain <svg> root", () => {
    assert.strictEqual(detectSvg(bytes(SAFE_SVG)), "safe");
  });

  it("accepts BOM, XML prolog, and comments before the root", () => {
    const svg = `﻿<?xml version="1.0" encoding="UTF-8"?>\n<!-- exported -->\n${SAFE_SVG}`;
    assert.strictEqual(detectSvg(bytes(svg)), "safe");
  });

  it("accepts the W3C SVG PUBLIC doctype", () => {
    const svg = `<?xml version="1.0"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n${SAFE_SVG}`;
    assert.strictEqual(detectSvg(bytes(svg)), "safe");
  });

  it("accepts a bare <!DOCTYPE svg>", () => {
    const svg = `<!DOCTYPE svg>\n${SAFE_SVG}`;
    assert.strictEqual(detectSvg(bytes(svg)), "safe");
  });

  it("rejects a SYSTEM doctype (external DTD / XXE vector)", () => {
    const svg = `<!DOCTYPE svg SYSTEM "http://evil.test/xxe.dtd">\n${SAFE_SVG}`;
    assert.strictEqual(detectSvg(bytes(svg)), "not-svg");
  });

  it("rejects a PUBLIC doctype with a non-W3C system identifier", () => {
    const svg = `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://evil.test/svg11.dtd">\n${SAFE_SVG}`;
    assert.strictEqual(detectSvg(bytes(svg)), "not-svg");
  });

  it("rejects a doctype with an internal subset", () => {
    const svg = `<!DOCTYPE svg [<!ENTITY x "y">]>\n${SAFE_SVG}`;
    assert.strictEqual(detectSvg(bytes(svg)), "not-svg");
  });

  it("rejects non-SVG text", () => {
    assert.strictEqual(
      detectSvg(bytes("<html><body>hi</body></html>")),
      "not-svg",
    );
  });

  it("rejects invalid UTF-8", () => {
    assert.strictEqual(detectSvg(INVALID_UTF8_BYTES), "not-svg");
  });

  it("rejects binary image bytes", () => {
    assert.strictEqual(detectSvg(PNG_BYTES), "not-svg");
  });
});

describe("detectSvg — active-content rejection", () => {
  const unsafeBody = (payload: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg">${payload}</svg>`;

  it("rejects <script>", () => {
    assert.strictEqual(
      detectSvg(bytes(unsafeBody(`<script>alert(1)</script>`))),
      "unsafe",
    );
  });

  it("rejects namespaced <h:script>", () => {
    const payload = `<h:script xmlns:h="http://www.w3.org/1999/xhtml">alert(1)</h:script>`;
    assert.strictEqual(detectSvg(bytes(unsafeBody(payload))), "unsafe");
  });

  it("rejects namespaced <svg:script>", () => {
    assert.strictEqual(
      detectSvg(bytes(unsafeBody(`<svg:script>alert(1)</svg:script>`))),
      "unsafe",
    );
  });

  it("rejects <foreignObject>", () => {
    assert.strictEqual(
      detectSvg(bytes(unsafeBody(`<foreignObject><div/></foreignObject>`))),
      "unsafe",
    );
  });

  it("rejects namespaced <x:foreignObject>", () => {
    assert.strictEqual(
      detectSvg(bytes(unsafeBody(`<x:foreignObject/>`))),
      "unsafe",
    );
  });

  it("rejects javascript: URLs", () => {
    assert.strictEqual(
      detectSvg(bytes(unsafeBody(`<a href="javascript:alert(1)">x</a>`))),
      "unsafe",
    );
  });

  it("rejects event handler attributes", () => {
    assert.strictEqual(
      detectSvg(bytes(unsafeBody(`<rect onload="alert(1)"/>`))),
      "unsafe",
    );
  });

  it("rejects numeric character references that could smuggle javascript:", () => {
    const payload = `<a href="jav&#x61;script:alert(1)">x</a>`;
    assert.strictEqual(detectSvg(bytes(unsafeBody(payload))), "unsafe");
  });

  it("rejects <iframe>", () => {
    assert.strictEqual(
      detectSvg(bytes(unsafeBody(`<iframe src="https://evil.test"/>`))),
      "unsafe",
    );
  });

  it("rejects namespaced <h:iframe>", () => {
    const payload = `<h:iframe xmlns:h="http://www.w3.org/1999/xhtml" src="https://evil.test"/>`;
    assert.strictEqual(detectSvg(bytes(unsafeBody(payload))), "unsafe");
  });

  it("rejects <embed>", () => {
    assert.strictEqual(
      detectSvg(bytes(unsafeBody(`<embed src="https://evil.test"/>`))),
      "unsafe",
    );
  });

  it("rejects <object>", () => {
    assert.strictEqual(
      detectSvg(bytes(unsafeBody(`<object data="https://evil.test"/>`))),
      "unsafe",
    );
  });

  it("rejects data:text/html URLs", () => {
    const payload = `<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>`;
    assert.strictEqual(detectSvg(bytes(unsafeBody(payload))), "unsafe");
  });

  it("rejects data:image/svg+xml URLs (nested SVG document)", () => {
    const payload = `<image href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/>`;
    assert.strictEqual(detectSvg(bytes(unsafeBody(payload))), "unsafe");
  });

  it("rejects typeless data:;base64 URLs", () => {
    const payload = `<a href="data:;base64,PHNjcmlwdD4=">x</a>`;
    assert.strictEqual(detectSvg(bytes(unsafeBody(payload))), "unsafe");
  });

  it("allows embedded raster data: images", () => {
    const payload = `<image width="10" height="10" href="data:image/png;base64,iVBORw0KGgo="/>`;
    assert.strictEqual(detectSvg(bytes(unsafeBody(payload))), "safe");
  });

  it("rejects <!ENTITY declarations anywhere in the document", () => {
    assert.strictEqual(
      detectSvg(bytes(`${SAFE_SVG}<!ENTITY x "y">`)),
      "unsafe",
    );
  });

  it("rejects an xml-stylesheet processing instruction before the root", () => {
    const svg = `<?xml version="1.0"?><?xml-stylesheet type="text/xsl" href="https://evil.test/x.xsl"?>${SAFE_SVG}`;
    assert.notStrictEqual(detectSvg(bytes(svg)), "safe");
  });

  it("rejects an xml-stylesheet processing instruction after the root", () => {
    assert.strictEqual(
      detectSvg(bytes(`${SAFE_SVG}<?xml-stylesheet href="x.xsl"?>`)),
      "unsafe",
    );
  });

  it("rejects a bare xml-stylesheet PI posing as the declaration", () => {
    const svg = `<?xml-stylesheet type="text/xsl" href="https://evil.test/x.xsl"?>${SAFE_SVG}`;
    assert.notStrictEqual(detectSvg(bytes(svg)), "safe");
  });

  it("rejects SMIL set targeting an event handler attribute", () => {
    assert.strictEqual(
      detectSvg(bytes(unsafeBody(`<set attributeName="onload" to="x"/>`))),
      "unsafe",
    );
  });

  it("rejects SMIL animate targeting an event handler attribute", () => {
    assert.strictEqual(
      detectSvg(
        bytes(unsafeBody(`<animate attributeName="onmouseover" to="x"/>`)),
      ),
      "unsafe",
    );
  });

  it("rejects a character-reference-smuggled event attributeName", () => {
    assert.strictEqual(
      detectSvg(bytes(unsafeBody(`<set attributeName="on&#x6C;oad" to="x"/>`))),
      "unsafe",
    );
  });

  it("rejects decimal character references that smuggle javascript:", () => {
    const payload = `<a href="jav&#97;script:alert(1)">x</a>`;
    assert.strictEqual(detectSvg(bytes(unsafeBody(payload))), "unsafe");
  });

  it("allows benign numeric character references in text content", () => {
    const payload = `<text x="1" y="1">caf&#xE9;&#160;&#x2014;&#8212;logo</text>`;
    assert.strictEqual(detectSvg(bytes(unsafeBody(payload))), "safe");
  });

  it("allows SMIL animation of presentation attributes", () => {
    const payload = `<rect width="4" height="4"><animate attributeName="opacity" values="0;1" dur="1s" repeatCount="indefinite"/></rect>`;
    assert.strictEqual(detectSvg(bytes(unsafeBody(payload))), "safe");
  });

  it("does not false-positive on element names containing 'script'", () => {
    assert.strictEqual(
      detectSvg(bytes(unsafeBody(`<desc>PostScript logo description</desc>`))),
      "safe",
    );
  });
});

describe("resolveLogoImageType", () => {
  it("resolves binary types by magic bytes", () => {
    const resolved = resolveLogoImageType(PNG_BYTES);
    assert.deepStrictEqual(resolved, {
      ok: true,
      type: { mime: "image/png", extension: "png" },
    });
  });

  it("resolves a safe SVG to image/svg+xml", () => {
    const resolved = resolveLogoImageType(bytes(SAFE_SVG));
    assert.deepStrictEqual(resolved, {
      ok: true,
      type: { mime: "image/svg+xml", extension: "svg" },
    });
  });

  it("rejects an SVG with active content as active-svg, not unsupported", () => {
    const resolved = resolveLogoImageType(
      bytes(`<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>`),
    );
    assert.deepStrictEqual(resolved, { ok: false, reason: "active-svg" });
  });

  it("rejects unknown text as unsupported", () => {
    assert.deepStrictEqual(resolveLogoImageType(bytes("plain text")), {
      ok: false,
      reason: "unsupported",
    });
  });

  it("rejects invalid UTF-8 binary garbage as unsupported", () => {
    assert.deepStrictEqual(resolveLogoImageType(INVALID_UTF8_BYTES), {
      ok: false,
      reason: "unsupported",
    });
  });
});
