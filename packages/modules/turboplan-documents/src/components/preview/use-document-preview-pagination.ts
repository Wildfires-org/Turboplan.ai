"use client";

import { useCallback, useState } from "react";

export function useDocumentPreviewPagination() {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const handlePrevious = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    },
    [totalPages],
  );

  const handleCurrentPageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleTotalPagesChange = useCallback((pages: number) => {
    setTotalPages(pages);
  }, []);

  return {
    currentPage,
    totalPages,
    setCurrentPage,
    setTotalPages,
    handlePrevious,
    handleNext,
    handlePageChange,
    handleCurrentPageChange,
    handleTotalPagesChange,
  };
}
