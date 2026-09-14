"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationControlsProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between w-full gap-2",
        className,
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="bg-white disabled:opacity-100 disabled:bg-neutral-100 disabled:text-neutral-grey3"
      >
        <ArrowLeftIcon className="size-4" />
      </Button>

      <div className="flex items-center gap-4">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            type="button"
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              "w-10 h-10 rounded-full text-sm font-medium transition-colors",
              currentPage === page
                ? "border border-green-60 text-green-60 bg-green-60/10"
                : "text-gray-700 border border-gray-200 hover:text-neutral-black",
            )}
          >
            {page}
          </button>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className="bg-white disabled:opacity-100 disabled:bg-neutral-100 disabled:text-neutral-grey3"
      >
        <ArrowRightIcon className="size-4" />
      </Button>
    </div>
  );
}
