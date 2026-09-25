"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { renderAsync } from "docx-preview";
import { ExternalLink, Loader2 } from "lucide-react";

import { Button, isSafeHttpUrl } from "@wildfires-org/turboplan-utils";

export interface DocxViewerProps {
  url: string;
  currentPage: number;
  onTotalPagesChange: (totalPages: number) => void;
  onCurrentPageChange?: (page: number) => void;
}

export function DocxViewer({
  url,
  currentPage,
  onTotalPagesChange,
  onCurrentPageChange,
}: DocxViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastScrollPageRef = useRef(1);
  const rafRef = useRef(0);

  const render = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch document");

      const arrayBuffer = await response.arrayBuffer();

      await renderAsync(arrayBuffer, containerRef.current, undefined, {
        breakPages: true,
        inWrapper: true,
        ignoreLastRenderedPageBreak: false,
      });

      // Count rendered page sections
      const sections = containerRef.current.querySelectorAll("section.docx");
      onTotalPagesChange(Math.max(sections.length, 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document");
    } finally {
      setIsLoading(false);
    }
  }, [url, onTotalPagesChange]);

  useEffect(() => {
    render();
  }, [render]);

  // Detect visible page on scroll
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const container = containerRef.current;
    if (!wrapper || !container || isLoading) return;

    const handleScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const sections = container.querySelectorAll("section.docx");
        if (sections.length === 0) return;

        const scrollTop = wrapper.scrollTop;
        const containerHeight = wrapper.clientHeight;
        const scrollCenter = scrollTop + containerHeight / 2;

        let closestPage = 1;
        let closestDistance = Number.POSITIVE_INFINITY;

        sections.forEach((section, index) => {
          const el = section as HTMLElement;
          const pageCenter = el.offsetTop + el.offsetHeight / 2;
          const distance = Math.abs(pageCenter - scrollCenter);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestPage = index + 1;
          }
        });

        if (closestPage !== lastScrollPageRef.current) {
          lastScrollPageRef.current = closestPage;
          onCurrentPageChange?.(closestPage);
        }
      });
    };

    wrapper.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      wrapper.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isLoading, onCurrentPageChange]);

  // Scroll to page when currentPage changes from navigation
  useEffect(() => {
    if (!containerRef.current || !wrapperRef.current || isLoading) return;
    if (currentPage === lastScrollPageRef.current) return;

    const sections = containerRef.current.querySelectorAll("section.docx");
    const targetSection = sections[currentPage - 1] as HTMLElement | undefined;
    if (targetSection) {
      wrapperRef.current.scrollTo({
        top: targetSection.offsetTop,
        behavior: "auto",
      });
      lastScrollPageRef.current = currentPage;
    }
  }, [currentPage, isLoading]);

  const isExternalUrl = isSafeHttpUrl(url);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <p className="text-sm">Failed to load document</p>
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
    <div className="relative size-full">
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <div
        ref={wrapperRef}
        className="size-full overflow-y-auto overflow-x-hidden"
        style={{ display: isLoading ? "none" : "block" }}
      >
        <div
          ref={containerRef}
          className="docx-viewer-container [&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!p-0 [&_.docx-wrapper]:!shadow-none [&_section.docx]:!w-full [&_section.docx]:!max-w-full [&_section.docx]:!overflow-hidden [&_section.docx]:!min-h-0 [&_section.docx]:!shadow-none"
        />
      </div>
    </div>
  );
}
