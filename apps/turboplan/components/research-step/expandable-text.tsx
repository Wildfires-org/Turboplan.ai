"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export const ExpandableText = ({ text }: { text: string }) => {
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      setIsClamped(el.scrollHeight > el.clientHeight);
    }
  }, [text]);

  return (
    <div className="mt-0.5">
      <p
        ref={ref}
        className={cn(
          "text-xs leading-relaxed text-gray-550",
          !isTextExpanded && "line-clamp-3",
        )}
      >
        {text}
      </p>
      {(isClamped || isTextExpanded) && (
        <button
          type="button"
          className="mt-0.5 cursor-pointer text-[11px] font-medium text-brand-900 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setIsTextExpanded(!isTextExpanded);
          }}
        >
          {isTextExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
};
