"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ExternalLink, Loader2 } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

import { Button, isSafeHttpUrl } from "@wildfires-org/turboplan-utils";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export interface PdfViewerProps {
  url: string;
  currentPage: number;
  onTotalPagesChange: (totalPages: number) => void;
  onCurrentPageChange?: (page: number) => void;
}

export function PdfViewer({
  url,
  currentPage,
  onTotalPagesChange,
  onCurrentPageChange,
}: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastScrollPageRef = useRef(1);
  const rafRef = useRef(0);

  // Measure container width
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    setContainerWidth(container.clientWidth);

    return () => observer.disconnect();
  }, []);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: pages }: { numPages: number }) => {
      setNumPages(pages);
      onTotalPagesChange(pages);
      setError(null);
    },
    [onTotalPagesChange],
  );

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message || "Failed to load PDF");
  }, []);

  // Detect visible page on scroll
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || numPages === 0) return;

    const handleScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const scrollCenter = scrollTop + containerHeight / 2;

        let closestPage = 1;
        let closestDistance = Number.POSITIVE_INFINITY;

        for (const [pageNum, el] of pageRefs.current) {
          const pageCenter = el.offsetTop + el.offsetHeight / 2;
          const distance = Math.abs(pageCenter - scrollCenter);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestPage = pageNum;
          }
        }

        if (closestPage !== lastScrollPageRef.current) {
          lastScrollPageRef.current = closestPage;
          onCurrentPageChange?.(closestPage);
        }
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [numPages, onCurrentPageChange]);

  // Scroll to page when currentPage changes from navigation
  useEffect(() => {
    if (currentPage === lastScrollPageRef.current) return;
    const pageEl = pageRefs.current.get(currentPage);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "auto", block: "start" });
      lastScrollPageRef.current = currentPage;
    }
  }, [currentPage]);

  const setPageRef = useCallback(
    (pageNum: number, el: HTMLDivElement | null) => {
      if (el) {
        pageRefs.current.set(pageNum, el);
      } else {
        pageRefs.current.delete(pageNum);
      }
    },
    [],
  );

  const isExternalUrl = isSafeHttpUrl(url);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <p className="text-sm">Failed to load PDF</p>
        <p className="text-xs">{error}</p>
        {isExternalUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(url, "_blank")}
          >
            <ExternalLink className="size-4" />
            Open in new tab
          </Button>
        )}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="size-full overflow-y-auto">
      <Document
        file={url}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        {numPages > 0 &&
          Array.from({ length: numPages }, (_, i) => (
            <div
              key={i + 1}
              ref={(el) => setPageRef(i + 1, el)}
              className="flex justify-center py-2"
            >
              <Page
                pageNumber={i + 1}
                width={containerWidth ?? undefined}
                loading={
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                }
              />
            </div>
          ))}
      </Document>
    </div>
  );
}
