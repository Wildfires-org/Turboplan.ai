import React from "react";

import assert from "node:assert";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { highlightPlaceholders } from "../lib/markdown-placeholders";

const render = (children: React.ReactNode): string => {
  return renderToStaticMarkup(<p>{highlightPlaceholders(children)}</p>);
};

describe("highlightPlaceholders (markdown surfaces)", () => {
  it("highlights a plain token in a single string child", () => {
    const html = render("Submit by [INSERT: comment deadline date] please.");
    assert.ok(html.includes("bg-yellow-100"));
    assert.ok(html.includes("[INSERT: comment deadline date]"));
  });

  it("highlights a token split by an autolinked URL, link inside the span", () => {
    // Simulates Streamdown output: the URL inside the token became an <a>.
    const html = render([
      "available online at: [INSERT: project web page URL — suggested: ",
      <a key="l" href="https://www.fs.usda.gov/project/">
        https://www.fs.usda.gov/project/
      </a>,
      " — verify the assigned project number and full URL for this project]",
    ]);

    const spanStart = html.indexOf('<span class="bg-yellow-100');
    assert.ok(spanStart !== -1, "highlight span missing");
    const spanEnd = html.indexOf("</span>", spanStart);
    const inside = html.slice(spanStart, spanEnd);
    // The whole token — including the anchor and the closing bracket — is
    // inside ONE highlight span.
    assert.ok(inside.includes("[INSERT: project web page URL"));
    assert.ok(inside.includes("<a href="));
    assert.ok(inside.includes("full URL for this project]"));
    // The lead-in text stays outside the highlight.
    assert.ok(html.indexOf("available online at: ") < spanStart);
  });

  it("highlights a token split by an autolinked email", () => {
    const html = render([
      "to: [INSERT: electronic comments email address — suggested: ",
      <a key="l" href="mailto:comments-pacificsouthwest-tahoe-truckee@usda.gov">
        comments-pacificsouthwest-tahoe-truckee@usda.gov
      </a>,
      "].",
    ]);
    const spanStart = html.indexOf('<span class="bg-yellow-100');
    assert.ok(spanStart !== -1);
    const inside = html.slice(spanStart, html.indexOf("</span>", spanStart));
    assert.ok(inside.includes("usda.gov"));
    // Trailing period stays outside the highlight.
    assert.ok(html.endsWith(".</p>"));
  });

  it("handles multiple tokens with a link in only one of them", () => {
    const html = render([
      "[INSERT: comment deadline] and [INSERT: project URL — suggested: ",
      <a key="l" href="https://example.gov/">
        https://example.gov/
      </a>,
      "] end.",
    ]);
    const count = html.split('<span class="bg-yellow-100').length - 1;
    assert.strictEqual(count, 2);
  });

  it("leaves children without tokens untouched", () => {
    const html = render([
      "See ",
      <a key="l" href="https://www.fs.usda.gov/">
        https://www.fs.usda.gov/
      </a>,
      " for details.",
    ]);
    assert.ok(!html.includes("bg-yellow-100"));
  });
});
