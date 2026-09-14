"use client";

import { useCallback, useRef, useState } from "react";

import { useLocalStorage } from "usehooks-ts";

interface UseResizablePanelConfig {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  direction?: "left" | "right";
}

/**
 * Generic hook for making a panel resizable via mouse drag.
 * Persists the width to localStorage and handles all mouse event lifecycle.
 *
 * @example
 * ```tsx
 * const { width, isDragging, handleResizeStart } = useResizablePanel({
 *   storageKey: "my-panel-width",
 *   defaultWidth: 400,
 *   minWidth: 300,
 *   maxWidth: 800,
 * });
 *
 * return (
 *   <div style={{ width }}>
 *     <div onMouseDown={handleResizeStart} className="resize-handle" />
 *     {children}
 *   </div>
 * );
 * ```
 */
export const useResizablePanel = ({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  direction = "left",
}: UseResizablePanelConfig) => {
  const [width, setWidth] = useLocalStorage(storageKey, defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;

      const handleMouseMove = (e: MouseEvent) => {
        const delta =
          direction === "right"
            ? e.clientX - startXRef.current
            : startXRef.current - e.clientX;
        const newWidth = Math.min(
          maxWidth,
          Math.max(minWidth, startWidthRef.current + delta),
        );
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width, setWidth, minWidth, maxWidth, direction],
  );

  return { width, isDragging, handleResizeStart };
};
