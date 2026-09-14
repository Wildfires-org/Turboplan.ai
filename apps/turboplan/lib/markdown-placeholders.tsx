import React from "react";

import { createSplitPlaceholderRegex } from "@/lib/placeholders";

const HIGHLIGHT_CLASS =
  "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 px-0.5 rounded-sm";

const textContent = (node: React.ReactNode): string => {
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textContent).join("");
  }
  if (React.isValidElement(node)) {
    return textContent((node.props as { children?: React.ReactNode }).children);
  }
  return "";
};

// Highlights placeholder tokens across the block's WHOLE child list, not per
// string child: an autolinked URL or email inside a token splits the token
// around an <a> element, so a per-string scan misses it. Matches are found in
// the concatenated text and mapped back onto the children, splitting strings at
// the boundaries and pulling covered elements (links) inside the highlight.
export const highlightPlaceholders = (
  children: React.ReactNode,
): React.ReactNode => {
  const nodes = React.Children.toArray(children);
  const full = nodes.map(textContent).join("");

  const regex = createSplitPlaceholderRegex();
  regex.lastIndex = 0;
  const matches: Array<{ start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(full)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length });
  }
  if (matches.length === 0) {
    return children;
  }

  const out: React.ReactNode[] = [];
  let highlightBuf: React.ReactNode[] = [];
  let matchIdx = 0;
  let pos = 0;
  let key = 0;

  const closeHighlight = () => {
    if (highlightBuf.length > 0) {
      out.push(
        <span key={`ph-${key++}`} className={HIGHLIGHT_CLASS}>
          {highlightBuf}
        </span>,
      );
      highlightBuf = [];
    }
  };

  const emit = (node: React.ReactNode, inside: boolean) => {
    if (inside) {
      highlightBuf.push(node);
    } else {
      closeHighlight();
      out.push(node);
    }
  };

  for (const node of nodes) {
    const text = textContent(node);
    const len = text.length;

    if (typeof node === "string") {
      let local = 0;
      while (local < len) {
        const match = matches[matchIdx];
        if (!match || match.start >= pos + len) {
          emit(node.slice(local), false);
          local = len;
        } else if (pos + local < match.start) {
          emit(node.slice(local, match.start - pos), false);
          local = match.start - pos;
        } else {
          const sliceEnd = Math.min(len, match.end - pos);
          emit(node.slice(local, sliceEnd), true);
          local = sliceEnd;
          if (pos + local >= match.end) {
            matchIdx++;
            closeHighlight();
          }
        }
      }
    } else {
      const match = matches[matchIdx];
      const inside = match
        ? len === 0
          ? pos >= match.start && pos < match.end
          : pos < match.end && pos + len > match.start
        : false;
      emit(node, inside);
      if (match && len > 0 && pos + len >= match.end) {
        matchIdx++;
        closeHighlight();
      }
    }
    pos += len;
  }
  closeHighlight();
  return out;
};
