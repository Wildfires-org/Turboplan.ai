// Markdown → HTML plugins for the document editor (see parse-document.tsx).
// Documents follow the export dialect, where a single newline is a line break
// and only a blank line starts a new paragraph — e.g. a signature block
// ("MARIA DELGADO\nDistrict Ranger") or an address. The editor's serializer
// (markdown-serializer.ts) writes both back the same way, so an edit keeps the
// stored markdown in its original shape.

type MdastNode = {
  type: string;
  value?: string;
  children?: MdastNode[];
};

type HastNode = {
  type: string;
  properties?: Record<string, unknown>;
  position?: { start: { line: number }; end: { line: number } };
  children?: HastNode[];
};

const LINE_ENDING_REGEX = /[ \t]*\r?\n[ \t]*/;

const splitText = (node: MdastNode): MdastNode[] => {
  const lines = (node.value ?? "").split(LINE_ENDING_REGEX);
  const result: MdastNode[] = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      result.push({ type: "break" });
    }
    if (line) {
      result.push({ type: "text", value: line });
    }
  });
  return result;
};

const breakLines = (node: MdastNode) => {
  if (!node.children) {
    return;
  }
  node.children = node.children.flatMap((child) => {
    if (child.type === "text" && child.value?.includes("\n")) {
      return splitText(child);
    }
    breakLines(child);
    return [child];
  });
};

// Like remark-breaks: every soft line break inside a paragraph becomes a hard
// break (<br>).
export const remarkLineBreaks = () => (tree: MdastNode) => {
  breakLines(tree);
};

// Marks each top-level block that starts on the line right after the previous
// one ("# Title\n## Subtitle", "## Heading\nText") with `data-tight-before`, so
// the serializer can write a single newline there instead of a blank line.
// Runs after Streamdown's sanitizer, which would strip the attribute.
export const rehypeTightBlocks = () => (tree: HastNode) => {
  let previousEndLine: number | null = null;
  for (const child of tree.children ?? []) {
    if (child.type !== "element" || !child.position) {
      continue;
    }
    if (
      previousEndLine !== null &&
      child.position.start.line === previousEndLine + 1
    ) {
      child.properties = { ...child.properties, dataTightBefore: true };
    }
    previousEndLine = child.position.end.line;
  }
};
