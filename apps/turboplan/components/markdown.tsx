"use client";

import React, { memo, useEffect, useMemo, useState } from "react";

import type { CodeHighlighterPlugin } from "@streamdown/code";
import Link from "next/link";
import { type Components, Streamdown } from "streamdown";

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
    const firstChild = childArray[0];
    if (typeof firstChild === "string" && firstChild.startsWith("{right}")) {
      return (
        <p className="text-right" {...props}>
          {highlightPlaceholders([firstChild.slice(7), ...childArray.slice(1)])}
        </p>
      );
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

const NonMemoizedMarkdown = ({
  children,
  stripNotes = true,
}: {
  children: string;
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
  const normalized = source.replace(/(?<=.) *\{right\}/g, "\n\n{right}");
  const plugins = useMemo(
    () => (codePlugin ? { code: codePlugin } : undefined),
    [codePlugin],
  );
  return (
    <Streamdown
      className="size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      plugins={plugins}
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
    prevProps.stripNotes === nextProps.stripNotes,
);
