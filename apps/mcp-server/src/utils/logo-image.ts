// Logo image type detection for organization logo uploads. Binary types are
// sniffed by magic bytes; SVG has none and is detected textually with active
// content rejected (see detectSvg). Pure functions — no I/O — so the upload
// branching is unit-testable.

// A sniffed image type: the MIME used for both the stored blob and its file
// extension.
export interface SniffedImageType {
  mime: string;
  extension: string;
}

// Detect the image type from the leading magic bytes of the downloaded data.
// The remote Content-Type header is never trusted. Returns null when the bytes
// match none of the supported binary types.
export const sniffLogoImageType = (
  bytes: Uint8Array,
): SniffedImageType | null => {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: "image/png", extension: "png" };
  }

  // JPEG: FF D8 FF
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mime: "image/jpeg", extension: "jpg" };
  }

  // WebP: "RIFF" at offset 0 and "WEBP" at offset 8.
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return { mime: "image/webp", extension: "webp" };
  }

  return null;
};

// SVG root detection: optional BOM/whitespace, then any mix of an XML prolog
// and comments, an optional DOCTYPE, more optional comments, then an <svg>
// root element. The prolog requires whitespace after `<?xml` so an
// `<?xml-stylesheet ...?>` processing instruction can never pose as the
// declaration. The only DOCTYPEs allowed are a bare `<!DOCTYPE svg>` and the
// W3C SVG PUBLIC doctype emitted by Illustrator/Inkscape — SYSTEM identifiers,
// non-W3C PUBLIC identifiers, and internal subsets (`[...]`, where XML
// entities live) are all rejected so no downstream XML consumer can be tricked
// into resolving an attacker-controlled DTD (SSRF/XXE).
export const SVG_ROOT_PATTERN =
  /^\uFEFF?\s*(?:<\?xml\s[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE\s+svg(?:\s+PUBLIC\s+"-\/\/W3C\/\/DTD SVG [^"]*"\s+"https?:\/\/www\.w3\.org\/[^"]*")?\s*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i;

// Active content that must never appear in a stored SVG. Logos render via
// <img>, where scripts never execute — but the stored file is directly
// navigable on the R2 public origin, so scriptable and document-embedding
// content is rejected outright rather than sanitized. What each alternative
// blocks:
// - script/foreignObject/iframe/embed/object, with an optional namespace
//   prefix — `<h:script xmlns:h="http://www.w3.org/1999/xhtml">` executes just
//   like `<script>` when the document is navigated to.
// - Any processing instruction other than the XML declaration — an
//   `<?xml-stylesheet ...?>` PI applies XSLT on navigation, which can emit
//   attacker HTML/JS.
// - `attributeName` pointing at an event handler — SMIL `<set>`/`<animate>`
//   can arm `onload`-style handlers without a literal `on*=` attribute.
// - `data:` URLs for anything but embedded raster images (a common pattern in
//   exported SVGs) — text/html, image/svg+xml, and typeless base64 data: URLs
//   can carry a nested document.
export const SVG_ACTIVE_CONTENT_PATTERN =
  /<(?:[\w.-]+:)?(?:script|foreignobject|iframe|embed|object)|<\?(?!xml\s)|javascript:|<!entity|\battributename\s*=\s*["']?\s*on|\bon[a-z]+\s*=|data:(?!image\/(?:png|jpe?g|gif|webp)[;,])/i;

// XML parsers decode numeric character references (`&#106;` / `&#x6A;`) inside
// attribute values, so `href="jav&#x61;script:..."` reaches the browser as
// `javascript:`. The active-content scan therefore runs on decoded text —
// which also keeps legitimate references (em dashes, accented characters in
// labels) from tripping the filter. XML decodes exactly once, so one
// replacement pass mirrors what a consumer will see.
const NUMERIC_CHAR_REF_PATTERN = /&#(x[0-9a-f]+|\d+);/gi;

const decodeNumericCharRefs = (text: string): string =>
  text.replace(NUMERIC_CHAR_REF_PATTERN, (_match, code: string) => {
    const isHex = code[0] === "x" || code[0] === "X";
    const codePoint = isHex
      ? Number.parseInt(code.slice(1), 16)
      : Number.parseInt(code, 10);
    if (!Number.isInteger(codePoint) || codePoint > 0x10ffff) {
      return "�";
    }
    return String.fromCodePoint(codePoint);
  });

export const detectSvg = (bytes: Uint8Array): "safe" | "unsafe" | "not-svg" => {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return "not-svg";
  }
  if (!SVG_ROOT_PATTERN.test(text)) {
    return "not-svg";
  }
  if (SVG_ACTIVE_CONTENT_PATTERN.test(decodeNumericCharRefs(text))) {
    return "unsafe";
  }
  return "safe";
};

export type LogoImageResolution =
  | { ok: true; type: SniffedImageType }
  | { ok: false; reason: "active-svg" | "unsupported" };

// Full type-resolution branch for a downloaded logo: binary sniff first, then
// SVG detection with active-content rejection.
export const resolveLogoImageType = (
  bytes: Uint8Array,
): LogoImageResolution => {
  const sniffed = sniffLogoImageType(bytes);
  if (sniffed) {
    return { ok: true, type: sniffed };
  }

  const svg = detectSvg(bytes);
  if (svg === "unsafe") {
    return { ok: false, reason: "active-svg" };
  }
  if (svg === "safe") {
    return { ok: true, type: { mime: "image/svg+xml", extension: "svg" } };
  }
  return { ok: false, reason: "unsupported" };
};
