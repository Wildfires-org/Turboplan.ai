import { useState } from "react";

import { useDebounceCallback } from "usehooks-ts";

type Filterable = {
  name: string;
  description?: string | null;
  status?: string;
};
type SortComparatorFactory<T> = (sortBy: string) => (a: T, b: T) => number;

interface UseFilteredPaginatedListOptions<T> {
  items: T[];
  getSortComparator: SortComparatorFactory<T>;
  defaultSort?: string;
  defaultPageSize?: number;
  defaultStatusFilter?: string;
  statusField?: string;
}

export function useFilteredPaginatedList<T extends Filterable>({
  items,
  getSortComparator,
  defaultSort = "name-asc",
  defaultPageSize = 9,
  defaultStatusFilter = "active",
  statusField = "status",
}: UseFilteredPaginatedListOptions<T>) {
  // Filter & sort state
  const [statusFilter, setStatusFilter] = useState(defaultStatusFilter);
  const [sortBy, setSortBy] = useState(defaultSort);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Pagination state
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search
  const debouncedSearch = useDebounceCallback(setDebouncedSearchTerm, 300);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    debouncedSearch(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (value: number) => {
    setPageSize(value);
    setCurrentPage(1);
  };

  // ── Filtering ────────────────────────────────────────────────────────

  const comparator = getSortComparator(sortBy);

  const filteredItems = items
    .filter((item) => {
      const itemStatus = (item as Record<string, unknown>)[
        statusField as string
      ] as string | undefined;
      if (statusFilter !== "all" && itemStatus !== statusFilter) {
        return false;
      }

      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.toLowerCase();
        const matchesName = item.name?.toLowerCase().includes(term);
        const matchesDescription = item.description
          ?.toLowerCase()
          .includes(term);
        if (!matchesName && !matchesDescription) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      // Archived always last
      const aStatus = (a as Record<string, unknown>)[statusField as string] as
        | string
        | undefined;
      const bStatus = (b as Record<string, unknown>)[statusField as string] as
        | string
        | undefined;
      if (aStatus === "archived" && bStatus !== "archived") return 1;
      if (aStatus !== "archived" && bStatus === "archived") return -1;

      return comparator(a, b);
    });

  // ── Pagination ───────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = filteredItems.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return {
    statusFilter,
    handleStatusFilterChange,
    sortBy,
    setSortBy,
    searchTerm,
    debouncedSearchTerm,
    handleSearchChange,
    pageSize,
    handlePageSizeChange,
    currentPage,
    setCurrentPage,
    filteredItems,
    paginatedItems,
    totalPages,
    safePage,
  };
}
