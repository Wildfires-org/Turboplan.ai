"use client";

import React, { memo, useEffect, useMemo, useState } from "react";

import type { CodeHighlighterPlugin } from "@streamdown/code";
import Link from "next/link";
import {
  type Components,
  defaultRehypePlugins,
  defaultRemarkPlugins,
  Streamdown,
} from "streamdown";

import {
  rehypeTightBlocks,
  remarkLineBreaks,
} from "@/lib/editor/markdown-plugins";
import { highlightPlaceholders } from "@/lib/markdown-placeholders";
import {
  stripPlaceholderNotes,
  stripPlaceholderNotesInTableRows,
} from "@/lib/placeholders";

// Shiki's bundled grammars weigh ~23 MB. Loading `@streamdown/code` lazily on
// the client after mount keeps them out of the Worker server bundle (128 MB
// isolate limit) and off the SSR path, where the highlighter cannot run anyway
// (its `highlight()` returns null until the async load finishes).
let cachedCodePlugin: CodeHighlighterPlugin | null = null;
let codePluginPromise: Promise<CodeHighlighterPlugin> | null = null;

const useCodePlugin = () => {
  const [codePlugin, setCodePlugin] = useState<CodeHighlighterPlugin | null>(
    cachedCodePlugin,
  );

  useEffect(() => {
    if (cachedCodePlugin) {
      return;
    }
    let isMounted = true;
    if (!codePluginPromise) {
      codePluginPromise = import("@streamdown/code").then(
        (module) => module.code,
      );
    }
    codePluginPromise
      .then((plugin) => {
        cachedCodePlugin = plugin;
        if (isMounted) {
          setCodePlugin(plugin);
        }
      })
      .catch(() => {
        // Highlighting stays off if the chunk fails to load.
        codePluginPromise = null;
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return codePlugin;
};

// `{right}` / `{center}` line prefixes from the document dialect (see
// lib/export/markdown-to-docx.ts).
const ALIGNED_LINE_REGEX = /^\{(right|center)\}/;
const ALIGN_CLASSES: Record<string, string> = {
  right: "text-right",
  center: "text-center",
};

// The editor renders soft breaks as <br> (see remarkLineBreaks), so one markdown
// paragraph can hold several aligned lines ("{right}A\n{right}B") or an aligned
// line followed by body text. The export treats each line on its own, so split
// such a paragraph: every aligned line becomes its own aligned <p>, and the
// other lines stay together, joined by <br>. `data-tight-before` records that a
// part sat on the next line (not after a blank line), so the editor's
// serializer writes it back that way.
type ParagraphGroup = { align: string | null; lines: React.ReactNode[][] };

const isLineBreak = (node: React.ReactNode) =>
  React.isValidElement(node) && node.type === "br";

const splitLines = (children: React.ReactNode[]): React.ReactNode[][] => {
  const lines: React.ReactNode[][] = [[]];
  for (const child of children) {
    const line = lines[lines.length - 1];
    if (isLineBreak(child)) {
      lines.push([]);
    } else if (typeof child === "string" && line.length === 0) {
      // Drop the "\n" that follows each <br> in the HTML, so a marker at the
      // start of the line is found.
      const text = child.replace(/^\n/, "");
      if (text) {
        line.push(text);
      }
    } else {
      line.push(child);
    }
  }
  return lines;
};

const lineAlignment = (line: React.ReactNode[]) => {
  const first = line[0];
  return typeof first === "string"
    ? (first.match(ALIGNED_LINE_REGEX)?.[1] ?? null)
    : null;
};

const stripAlignment = (line: React.ReactNode[]): React.ReactNode[] => {
  const [first, ...rest] = line;
  return [String(first).replace(ALIGNED_LINE_REGEX, ""), ...rest];
};

const groupLines = (lines: React.ReactNode[][]): ParagraphGroup[] => {
  const groups: ParagraphGroup[] = [];
  for (const line of lines) {
    const align = lineAlignment(line);
    const last = groups.at(-1);
    if (align) {
      groups.push({ align, lines: [stripAlignment(line)] });
    } else if (last && !last.align) {
      last.lines.push(line);
    } else {
      groups.push({ align: null, lines: [line] });
    }
  }
  return groups;
};

const joinLines = (lines: React.ReactNode[][]): React.ReactNode[] =>
  lines.flatMap((line, index) =>
    index === 0 ? line : [<br key={`br-${index}`} />, ...line],
  );

const components: Partial<Components> = {
  a: ({ node, children, ...props }) => {
    return (
      <Link
        className="text-blue-500 hover:underline"
        target="_blank"
        rel="noreferrer"
        {...(props as React.ComponentProps<typeof Link>)}
      >
        {highlightPlaceholders(children)}
      </Link>
    );
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        {highlightPlaceholders(children)}
      </span>
    );
  },
  em: ({ node, children, ...props }) => {
    return <em {...props}>{highlightPlaceholders(children)}</em>;
  },
  p: ({ node, children, ...props }) => {
    const childArray = React.Children.toArray(children);
    const lines = splitLines(childArray);
    if (lines.length > 1 && lines.some((line) => lineAlignment(line))) {
      const groups = groupLines(lines);
      return (
        <>
          {groups.map((group, index) => (
            <p
              key={index}
              {...props}
              {...(index > 0 && { "data-tight-before": true })}
              className={group.align ? ALIGN_CLASSES[group.align] : undefined}
            >
              {highlightPlaceholders(joinLines(group.lines))}
            </p>
          ))}
        </>
      );
    }
    const firstChild = childArray[0];
    if (typeof firstChild === "string") {
      const alignMatch = firstChild.match(ALIGNED_LINE_REGEX);
      if (alignMatch) {
        return (
          <p className={ALIGN_CLASSES[alignMatch[1]]} {...props}>
            {highlightPlaceholders([
              firstChild.slice(alignMatch[0].length),
              ...childArray.slice(1),
            ])}
          </p>
        );
      }
    }
    return <p {...props}>{highlightPlaceholders(children)}</p>;
  },
  th: ({ node, children, ...props }) => {
    return <th {...props}>{highlightPlaceholders(children)}</th>;
  },
  td: ({ node, children, ...props }) => {
    return <td {...props}>{highlightPlaceholders(children)}</td>;
  },
  li: ({ node, children, ...props }) => {
    return <li {...props}>{highlightPlaceholders(children)}</li>;
  },
};

const EDITOR_REMARK_PLUGINS = [
  ...Object.values(defaultRemarkPlugins),
  remarkLineBreaks,
];
const EDITOR_REHYPE_PLUGINS = [
  ...Object.values(defaultRehypePlugins),
  rehypeTightBlocks,
];
// One block, so rehypeTightBlocks sees how every block sits against the last.
const parseAsOneBlock = (markdown: string) => [markdown];

const NonMemoizedMarkdown = ({
  children,
  stripNotes = true,
  lineBreaks = false,
}: {
  children: string;
  // The document editor treats a single newline as a line break, like the
  // PDF/DOCX export. Chat and other display surfaces keep markdown's default.
  lineBreaks?: boolean;
  // Display surfaces (chat, copy) strip reviewer-guidance notes. The editor's
  // document builder passes `false` so the notes survive into the ProseMirror
  // doc — and thus through edits to the docx export — where a decoration hides
  // them on screen instead.
  stripNotes?: boolean;
}) => {
  const codePlugin = useCodePlugin();
  // Notes inside table rows are stripped even when stripNotes is false — their
  // pipes would break the table parse (see stripPlaceholderNotesInTableRows).
  const source = stripNotes
    ? stripPlaceholderNotes(children)
    : stripPlaceholderNotesInTableRows(children);
  const normalized = source.replace(/(?<=.) *\{(right|center)\}/g, "\n\n{$1}");
  const editorProps = lineBreaks
    ? {
        remarkPlugins: EDITOR_REMARK_PLUGINS,
        rehypePlugins: EDITOR_REHYPE_PLUGINS,
        parseMarkdownIntoBlocksFn: parseAsOneBlock,
      }
    : {};
  const plugins = useMemo(
    () => (codePlugin ? { code: codePlugin } : undefined),
    [codePlugin],
  );
  return (
    <Streamdown
      className="size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      plugins={plugins}
      {...editorProps}
      components={components}
    >
      {normalized}
    </Streamdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.stripNotes === nextProps.stripNotes &&
    prevProps.lineBreaks === nextProps.lineBreaks,
);
