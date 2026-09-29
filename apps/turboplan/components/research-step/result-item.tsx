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
    <div className="border-l-2 border-brand-700/25 py-1 pl-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="glass inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-brand-900 transition-colors hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate max-w-[200px]">{title}</span>
        <ExternalLink size={10} className="shrink-0" />
      </a>
      {excerpt && <ExpandableText text={excerpt} />}
    </div>
  );
};
