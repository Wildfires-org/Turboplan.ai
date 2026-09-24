"use client";

import { type ReactNode, useId, useState } from "react";

import { ChevronDown } from "lucide-react";

import { CARD_CHIP_CLASS } from "@/components/catalog/catalog-layout";
import { cn } from "@/lib/utils";

interface PublicModuleSectionProps {
  title: string;
  // Rendered element (not the component) so server pages can pass it.
  icon: ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

// Collapsible glass card for one read-only project / template module.
// Content unmounts while collapsed, like the shared AccordionSection it
// replaces on the landing page.
export function PublicModuleSection({
  title,
  icon,
  count,
  defaultOpen = true,
  children,
}: PublicModuleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  const handleToggle = () => {
    setIsOpen((open) => !open);
  };

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <h2>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={handleToggle}
          className="group flex w-full items-center gap-3 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-700"
        >
          <span
            aria-hidden
            className="glass flex size-9 shrink-0 items-center justify-center rounded-xl text-brand-800 [&>svg]:size-[18px]"
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1 truncate font-heading text-[20px] font-normal leading-[28px] tracking-[-0.02em] text-egray-900 sm:text-[22px]">
            {title}
          </span>
          {count !== undefined && count > 0 && (
            <span className={cn(CARD_CHIP_CLASS, "text-brand-800")}>
              {count}
            </span>
          )}
          <ChevronDown
            aria-hidden
            className={cn(
              "size-5 shrink-0 text-egray-700 transition-transform duration-200 ease-out-expo motion-reduce:transition-none",
              isOpen && "rotate-180",
            )}
          />
        </button>
      </h2>
      {isOpen && (
        <div id={contentId} className="mt-5 sm:mt-6">
          {children}
        </div>
      )}
    </section>
  );
}
