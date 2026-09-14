"use client";

import { ExternalLink } from "lucide-react";

import { ExpandableText } from "./expandable-text";

export const ResultItem = ({
  title,
  url,
  excerpt,
}: {
  title: string;
  url: string;
  excerpt?: string;
}) => {
  return (
    <div className="py-1 border-l-2 border-muted pl-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate max-w-[200px]">{title}</span>
        <ExternalLink size={10} className="shrink-0" />
      </a>
      {excerpt && <ExpandableText text={excerpt} />}
    </div>
  );
};
