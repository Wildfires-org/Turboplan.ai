"use client";

import { useState } from "react";

import { ChevronUp } from "lucide-react";

export interface AccordionSectionProps {
  /** Section title */
  title: string;
  /** Section content */
  children: React.ReactNode;
  /** Default open state */
  defaultOpen?: boolean;
  /** Optional count to display as badge next to title */
  count?: number;
}

/**
 * Simple accordion section component for displaying collapsible content.
 * This is a read-only version without edit controls (visibility toggle, drag handle).
 * Use this for public/preview views of project modules.
 */
export function AccordionSection({
  title,
  children,
  defaultOpen = true,
  count,
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleClick = () => {
    setIsOpen((o) => !o);
  };

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div
          className="flex cursor-pointer items-center gap-3"
          onClick={handleClick}
        >
          <ChevronUp
            className={
              isOpen
                ? "h-5 w-5 transition-transform"
                : "h-5 w-5 transition-transform rotate-180"
            }
            aria-hidden={true}
          />
          <h2 className="text-base font-semibold leading-6 text-[#0c0d0e]">
            {title}
          </h2>
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-[#848496] px-2 py-1 text-xs font-medium leading-4 text-[#f6f6fd]">
              {count}
            </span>
          )}
        </div>
      </div>
      {isOpen && <div className="mt-4">{children}</div>}
    </div>
  );
}
