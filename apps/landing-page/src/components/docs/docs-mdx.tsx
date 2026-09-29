import type { ComponentProps } from "react";

import { Callout } from "fumadocs-ui/components/callout";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { Heading } from "fumadocs-ui/components/heading";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

import { cn } from "@/lib/utils";

// In-article headings: Geist with the site's negative tracking, one step
// down from the page title. `scroll-mt` clears the sticky navbar pill (and
// the mobile section bar) when jumping to an anchor.
const HEADING_BASE_CLASS =
  "scroll-mt-[calc(var(--fd-nav-height)+4.5rem)] font-heading font-medium text-egray-900";

const HEADING_CLASS = {
  h2: "text-[24px] leading-[1.25] tracking-[-0.03em] md:text-[26px]",
  h3: "text-[19px] leading-[1.3] tracking-[-0.02em]",
  h4: "text-[16px] leading-[1.4] tracking-[-0.01em]",
} as const;

// Light code surface: near-white, 1px white border, radius 16, the
// glass-card drop shadow. Scrolls horizontally inside its own box.
const CODE_BLOCK_CLASS =
  "my-6 rounded-2xl border border-white bg-white/85 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.9)]";

const CALLOUT_CLASS =
  "glass-card my-6 gap-3 rounded-2xl p-4 ps-2 text-[14px] shadow-[0_18px_48px_-34px_rgba(15,23,42,0.24)]";

// MDX element overrides for /docs. Components the content imports directly
// (e.g. `Card`/`Cards` from fumadocs-ui) bypass this map; those are themed in
// src/styles/fumadocs.css instead.
export const docsMdxComponents: MDXComponents = {
  ...defaultMdxComponents,
  h2: (props: ComponentProps<"h2">) => (
    <Heading
      as="h2"
      {...props}
      className={cn(HEADING_BASE_CLASS, HEADING_CLASS.h2, props.className)}
    />
  ),
  h3: (props: ComponentProps<"h3">) => (
    <Heading
      as="h3"
      {...props}
      className={cn(HEADING_BASE_CLASS, HEADING_CLASS.h3, props.className)}
    />
  ),
  h4: (props: ComponentProps<"h4">) => (
    <Heading
      as="h4"
      {...props}
      className={cn(HEADING_BASE_CLASS, HEADING_CLASS.h4, props.className)}
    />
  ),
  pre: (props: ComponentProps<"pre">) => (
    <CodeBlock {...props} className={cn(CODE_BLOCK_CLASS, props.className)}>
      <Pre>{props.children}</Pre>
    </CodeBlock>
  ),
  // Wide tables (e.g. the MCP tool list) scroll inside their own glass card
  // instead of widening the page on phones.
  table: (props: ComponentProps<"table">) => (
    <div className="glass-card my-6 overflow-x-auto">
      <table {...props} className={cn("my-0", props.className)} />
    </div>
  ),
  Callout: (props: ComponentProps<typeof Callout>) => (
    <Callout {...props} className={cn(CALLOUT_CLASS, props.className)} />
  ),
};
