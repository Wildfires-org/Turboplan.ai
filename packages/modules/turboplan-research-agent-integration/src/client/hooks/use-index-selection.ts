"use client";

import { useMemo, useState } from "react";

type UseIndexSelectionOptions<TItem> = {
  items: TItem[];
  isSelectable: (item: TItem, index: number) => boolean;
};

export function useIndexSelection<TItem>({
  items,
  isSelectable,
}: UseIndexSelectionOptions<TItem>) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );

  const selectableIndices = useMemo(
    () =>
      items
        .map((item, index) => ({ item, index }))
        .filter(({ item, index }) => isSelectable(item, index))
        .map(({ index }) => index),
    [isSelectable, items],
  );

  const selectedCount = selectedIndices.size;
  const isAllSelected =
    selectableIndices.length > 0 && selectedCount === selectableIndices.length;

  const isIndexSelected = (index: number) => selectedIndices.has(index);

  const toggleIndex = (index: number) => {
    setSelectedIndices((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIndices((previous) => {
      if (previous.size === selectableIndices.length) {
        return new Set();
      }
      return new Set(selectableIndices);
    });
  };

  const deselectIndex = (index: number) => {
    setSelectedIndices((previous) => {
      if (!previous.has(index)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(index);
      return next;
    });
  };

  const clear = () => {
    setSelectedIndices(new Set());
  };

  return {
    selectedIndices,
    selectedCount,
    selectableIndices,
    isIndexSelected,
    isAllSelected,
    toggleIndex,
    toggleAll,
    deselectIndex,
    clear,
  };
}
