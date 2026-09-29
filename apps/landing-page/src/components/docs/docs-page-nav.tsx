import type * as PageTree from "fumadocs-core/page-tree";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface DocsPageNavProps {
  previous?: PageTree.Item;
  next?: PageTree.Item;
}

// Same recipe as the catalog's clickable glass cards: hover only lightens the
// surface, `press` owns the active scale.
const CARD_CLASS =
  "glass-card press group flex min-w-0 flex-col gap-1 p-4 hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 sm:p-5";

// Replaces Fumadocs' PageFooter (grey bordered prev/next boxes).
export function DocsPageNav({ previous, next }: DocsPageNavProps) {
  if (!previous && !next) {
    return null;
  }

  return (
    <nav
      aria-label="Docs pages"
      className="mt-6 grid grid-cols-1 gap-3 border-t border-brandAlt-200 pt-8 pb-2 sm:grid-cols-2"
    >
      {previous ? (
        <DocsPageNavCard item={previous} direction="previous" />
      ) : (
        <span className="hidden sm:block" />
      )}
      {next ? <DocsPageNavCard item={next} direction="next" /> : null}
    </nav>
  );
}

interface DocsPageNavCardProps {
  item: PageTree.Item;
  direction: "previous" | "next";
}

function DocsPageNavCard({ item, direction }: DocsPageNavCardProps) {
  const isNext = direction === "next";
  const Icon = isNext ? ArrowRight : ArrowLeft;

  return (
    <Link href={item.url} className={cn(CARD_CLASS, isNext && "text-end")}>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-inter text-[13px] text-egray-700",
          isNext && "flex-row-reverse",
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        {isNext ? "Next" : "Previous"}
      </span>
      <span className="truncate font-heading text-[16px] font-medium tracking-[-0.02em] text-egray-900 group-hover:text-brand-800">
        {item.name}
      </span>
    </Link>
  );
}
