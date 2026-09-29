"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const PAGE_BUTTON_CLASS =
  "glass press inline-flex size-10 items-center justify-center rounded-xl font-inter text-[14px] font-medium text-egray-700 hover:bg-white/80 hover:text-egray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:pointer-events-none disabled:opacity-40";

export default function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationControlsProps) {
  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-center gap-2",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className={PAGE_BUTTON_CLASS}
      >
        <ArrowLeftIcon className="size-4" />
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button
          type="button"
          key={page}
          onClick={() => onPageChange(page)}
          aria-label={`Page ${page}`}
          aria-current={currentPage === page ? "page" : undefined}
          className={cn(
            PAGE_BUTTON_CLASS,
            "aria-[current=page]:bg-white aria-[current=page]:text-brand-800 aria-[current=page]:ring-1 aria-[current=page]:ring-brand-700/30",
          )}
        >
          {page}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className={PAGE_BUTTON_CLASS}
      >
        <ArrowRightIcon className="size-4" />
      </button>
    </nav>
  );
}
