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
          "text-xs leading-relaxed text-muted-foreground/80",
          !isTextExpanded && "line-clamp-3",
        )}
      >
        {text}
      </p>
      {(isClamped || isTextExpanded) && (
        <button
          type="button"
          className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground hover:underline cursor-pointer mt-0.5"
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
