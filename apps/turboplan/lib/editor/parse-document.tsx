import React from "react";

import { DOMParser } from "prosemirror-model";
import { renderToString } from "react-dom/server";

import { Markdown } from "@/components/markdown";
import { documentSchema } from "./config";

// Markdown → ProseMirror doc, through the same Streamdown HTML the chat shows.
// Keep reviewer-guidance notes ("|| ...") in the document so editor edits
// round-trip them back to storage and the docx export can still turn them into
// comments. They are hidden on screen by placeholderHighlightPlugin.
// `lineBreaks`: a single newline is a line break, as in the PDF/DOCX export.
export const buildDocumentFromContent = (content: string) => {
  const parser = DOMParser.fromSchema(documentSchema);
  const stringFromMarkdown = renderToString(
    <Markdown stripNotes={false} lineBreaks>
      {content}
    </Markdown>,
  );
  const tempContainer = document.createElement("div");
  tempContainer.innerHTML = stringFromMarkdown;
  return parser.parse(tempContainer);
};
