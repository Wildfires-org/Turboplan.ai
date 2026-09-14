"use client";

import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface DragHandleProps {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  isDragging: boolean;
}

interface SortableModuleProps {
  id: string;
  children: (dragHandleProps: DragHandleProps) => React.ReactNode;
}

/**
 * Sortable wrapper for module sections
 * Uses CSS transforms for smooth drag animations without re-renders
 * Passes drag handle props to children so only specific elements can trigger drag
 */
export function SortableModule({ id, children }: SortableModuleProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    // Use scaleY(1) to prevent height changes during sorting
    // This ensures taller items don't shrink when moved over smaller items
    transform: CSS.Transform.toString(
      transform ? { ...transform, scaleX: 1, scaleY: 1 } : null,
    ),
    transition,
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 1000 : "auto",
    position: "relative",
    // Add solid background, padding, and shadow when dragging to make it stand out
    backgroundColor: isDragging ? "hsl(var(--background))" : undefined,
    padding: isDragging ? "1rem" : undefined,
    margin: isDragging ? "-1rem" : undefined, // Compensate padding to keep position
    borderRadius: isDragging ? "1rem" : undefined,
    boxShadow: isDragging
      ? "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px hsl(var(--border))"
      : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}
