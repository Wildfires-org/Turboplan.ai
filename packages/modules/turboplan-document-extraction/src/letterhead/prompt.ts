/**
 * Width the header is rendered at. Claude downscales an image whose long edge
 * is over 1568 px (or that would cost more than ~1,600 tokens) and answers in
 * the downscaled image's pixels; rendering at exactly this width, with the
 * height capped by {@link LETTERHEAD_MAX_HEADER_HEIGHT}, keeps the model's
 * block boxes in our pixel space so they can be compared with logo boxes.
 */
export const LETTERHEAD_RENDER_WIDTH = 1568;

/**
 * Tallest header crop sent at {@link LETTERHEAD_RENDER_WIDTH}: ~1.15
 * megapixels (~1,530 tokens), under the downscale threshold. The top 30 % of
 * a Letter or A4 page (609 / 665 px) fits; only taller pages are cut.
 */
export const LETTERHEAD_MAX_HEADER_HEIGHT = 733;

/**
 * Vision prompt for the header crop of a document's first page
 * (the top ~30 % rendered {@link LETTERHEAD_RENDER_WIDTH} px wide). The model
 * reports meaning — whether there is a letterhead, its text blocks, their
 * roles and which are lettering of the logo (a wordmark); the grid is
 * computed in code from the block geometry (see
 * `toGridDraft`). The manual letterhead import in settings keeps its own
 * prompt in `apps/server`.
 */
export const buildLetterheadAnalysisPrompt = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): string =>
  `This image is the top of a document page (${width}x${height} pixels). Read its letterhead (the printed header with the organization's identity), if there is one.

Return ONLY a JSON object:
{
  "hasLetterhead": boolean,            // false for plain document titles, cover pages, forms without an organization header
  "blocks": [                          // text blocks of the letterhead; a block = lines stacked together (one column)
    { "role": "name" | "contact", "lines": [string], "wordmark": boolean, "box": { "x": n, "y": n, "width": n, "height": n } }
  ]
}
Rules: "name" blocks hold organization, department, division or office names; "contact" blocks hold address, phone, fax, web and email lines — a block holds lines of one role only, so a column with names above its address is two blocks. A block never spans printed columns: text set side by side with a horizontal gap is separate blocks, even when it continues one name (e.g. "United States Department of Agriculture" and "Forest Service" printed next to each other are two blocks). "wordmark" is true only when the block's lettering is part of the logo design — the organization's name in custom type set together with its symbol as one graphic (a lockup) — and false for ordinary typeset text (names, departments, offices, addresses, phone lines in a regular font). Text exactly as printed, one printed line = one entry; never include lettering inside a seal or emblem; ignore File Code, Date, reference-number and subject lines, titles, recipients and body text — they are not part of the letterhead; pixel coordinates of this image, origin top-left.`;
