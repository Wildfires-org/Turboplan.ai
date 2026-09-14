import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@wildfires-org/turboplan-utils";

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
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <span className="text-sm text-gray-500">
        {(currentPage - 1) * pageSize + 1}–
        {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </span>
      <Button
        aria-label="Previous page"
        variant="ghost"
        size="sm"
        className="size-8 p-0"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        aria-label="Next page"
        variant="ghost"
        size="sm"
        className="size-8 p-0"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
