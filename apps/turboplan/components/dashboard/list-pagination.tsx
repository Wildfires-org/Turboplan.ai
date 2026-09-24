import { ChevronLeft, ChevronRight } from "lucide-react";

import { GLASS_ICON_BUTTON_CLASS } from "@/lib/glass";

interface ListPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function ListPagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
}: ListPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <span className="text-sm tabular-nums text-gray-550">
        {(currentPage - 1) * pageSize + 1}–
        {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </span>
      <button
        type="button"
        aria-label="Previous page"
        className={GLASS_ICON_BUTTON_CLASS}
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Next page"
        className={GLASS_ICON_BUTTON_CLASS}
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
